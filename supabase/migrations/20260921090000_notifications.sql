-- =============================================================
-- In-app notifications for document change requests
-- =============================================================
--
-- Every change request transition was silent. A row lands here instead,
-- written by a trigger in the same transaction as the status change: if the
-- transition rolls back, so does the notification, and there is no window
-- where one exists without the other. Nothing writes this table from
-- TypeScript.
--
-- A row carries no document content — recipient, type, a link and a subject
-- id. The email pass builds its message from the link, so the mail provider
-- never receives an IMS document's name, reason or revision.

create type notification_type as enum (
  'change_request_awaiting_owner',
  'change_request_awaiting_ims',
  'change_request_returned',
  'change_request_published'
);

-- subject_id carries no foreign key, the same polymorphic shape as
-- actions.source_id: today every row points at a change request, and the
-- next notification kind will point somewhere else.
--
-- email_attempted_at / email_error are written by the email pass, not by
-- the trigger. They live here so a send is recorded against the row it sent,
-- which is what makes a retry able to tell a failure from a never-tried.
create table notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_id        uuid not null references profiles(id),
  actor_id            uuid references profiles(id),
  type                notification_type not null,
  subject_id          uuid not null,
  link                text not null,
  created_at          timestamptz not null default now(),
  read_at             timestamptz,
  email_attempted_at  timestamptz,
  email_error         text
);

-- The bell reads one recipient's newest rows and nothing else.
create index notifications_recipient_created_idx
  on notifications (recipient_id, created_at desc);

alter table notifications enable row level security;

-- Read and mark-as-read, your own rows only. No insert policy and no delete
-- policy: the trigger runs security definer as the table owner, so it is the
-- only writer, and a client cannot manufacture a notification for anyone.
create policy notifications_select
  on notifications for select
  to authenticated
  using (recipient_id = auth.uid());

create policy notifications_update
  on notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- The policy says which rows; the column grant says which columns. Without
-- it a recipient could satisfy notifications_update while rewriting their
-- own row's type or link, because the policy never looks at those. read_at
-- is the only column a client may set, and that is enforced here rather
-- than by the UI choosing not to send the others.
revoke all on notifications from anon, authenticated;
grant select on notifications to authenticated;
grant update (read_at) on notifications to authenticated;


-- -------------------------------------------------------------
-- Who reviews at the owner stage
-- -------------------------------------------------------------
--
-- can_review_document() answered "may I decide this?" and the notification
-- trigger needs "who do I tell?" — the same question from two directions.
-- Two copies of the rule drift, and the failure is silent: review lands in
-- one person's queue while the notification goes to another. So the rule is
-- defined once, as the set, and can_review_document() becomes a membership
-- test over it.
--
-- The three rules are unchanged from the fallback migration: the named
-- owner; failing that the department's managers; failing that IMS admins,
-- and only where the department has no manager at all. A blanket IMS
-- fallback would let IMS decide the owner stage on IT documents too, making
-- a two-stage review one person deciding twice.
--
-- No profile-status filter here. This function defines permission, and an
-- inactive profile that still holds the role can still decide. Whether a
-- person is worth telling is a different question, answered once, in the
-- trigger below.
create or replace function owner_stage_reviewers(doc uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- 1. The named owner, when there is one.
  select d.owner_id
  from documents d
  where d.id = doc
    and d.owner_id is not null

  union

  -- 2. Otherwise the managers of the document's department.
  select ur.profile_id
  from documents d
  join user_roles ur on ur.department_id = d.department_id
  join roles r on r.id = ur.role_id
  where d.id = doc
    and d.owner_id is null
    and r.key = 'department_manager'

  union

  -- 3. Otherwise IMS admins, but only where that department has no manager
  --    to route to. Org-wide, matching is_ims_admin(), which ignores the
  --    department on the role row.
  select ur.profile_id
  from user_roles ur
  join roles r on r.id = ur.role_id
  where r.key = 'ims_admin'
    and exists (
      select 1
      from documents d
      where d.id = doc
        and d.owner_id is null
        and not exists (
          select 1
          from user_roles m
          join roles mr on mr.id = m.role_id
          where mr.key = 'department_manager'
            and m.department_id = d.department_id
        )
    );
$$;

comment on function owner_stage_reviewers(uuid) is
  'The people who review a document at the owner stage: the named owner; the department managers when no owner is set; IMS admins when the department has no manager. The single definition behind both can_review_document() and the change request notification trigger.';

-- Membership test, not a second copy of the rule. exists() rather than
-- "auth.uid() in (...)" so a null auth.uid() — seeds, migrations — returns
-- false as it did before, instead of null.
create or replace function can_review_document(doc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from owner_stage_reviewers(doc) reviewer
    where reviewer = auth.uid()
  );
$$;

comment on function can_review_document(uuid) is
  'Is the caller a reviewer at the owner stage: membership of owner_stage_reviewers(doc).';


-- -------------------------------------------------------------
-- The trigger
-- -------------------------------------------------------------
--
-- Fires on INSERT as well as on a status change. raise_change_request()
-- inserts straight at pending_owner and never issues an UPDATE, so an
-- UPDATE-only trigger would miss every request raised through the app —
-- which is all of them.
--
-- security definer because the recipient is not the caller: an ordinary
-- requester has no insert privilege on notifications, and should not.
create or replace function notify_change_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipients uuid[];
  n_type     notification_type;
  n_link     text;
begin
  -- A draft is not yet anybody's business.
  if new.status = 'draft' then
    return null;
  end if;

  case new.status
    when 'pending_owner' then
      n_type     := 'change_request_awaiting_owner';
      n_link     := '/department/approvals';
      recipients := array(select owner_stage_reviewers(new.document_id));

    when 'pending_ims' then
      n_type     := 'change_request_awaiting_ims';
      n_link     := '/department/approvals';
      recipients := array(
        select ur.profile_id
        from user_roles ur
        join roles r on r.id = ur.role_id
        where r.key = 'ims_admin'
      );

    when 'rejected' then
      n_type     := 'change_request_returned';
      n_link     := '/department/documents/' || new.document_id;
      recipients := array[new.requester_id];

    when 'approved' then
      n_type     := 'change_request_published';
      n_link     := '/department/documents/' || new.document_id;
      recipients := array[new.requester_id];
  end case;

  -- Joining profiles does three jobs: it drops inactive people, it drops
  -- anyone whose role row no longer has a profile, and it collapses the
  -- duplicates a person with two matching role rows would otherwise get.
  --
  -- Skipping auth.uid() is what keeps the bell from telling you what you
  -- just did. A null auth.uid() is a seed or a migration with no actor, and
  -- "is distinct from" keeps everyone in that case rather than dropping all.
  insert into notifications (recipient_id, actor_id, type, subject_id, link)
  select p.id, auth.uid(), n_type, new.id, n_link
  from profiles p
  where p.id = any(recipients)
    and p.status = 'active'
    and p.id is distinct from auth.uid();

  return null;
end;
$$;

comment on function notify_change_request() is
  'Writes notifications for a change request entering a non-draft status. Same transaction as the status change, by design.';

create trigger document_change_requests_notify_insert
  after insert on document_change_requests
  for each row
  when (new.status <> 'draft')
  execute function notify_change_request();

create trigger document_change_requests_notify_update
  after update of status on document_change_requests
  for each row
  when (old.status is distinct from new.status)
  execute function notify_change_request();
