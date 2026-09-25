-- Document approval in two phases, matching MMCY's BPMN:
--   Phase 1 (permission): Requester -> Department Head -> QMS/ISMS Coordinator -> IMS Manager
--   Phase 2 (the document): draft -> QMS/ISMS "needs edit?" -> IMS Manager -> CTO/VP
--                           -> document control (a coordinator publishes)
-- A Deletion skips phase 2 and goes from the IMS Manager to document control (retire).
-- Nothing is published until document control.

-- ---------------------------------------------------------------------------
-- 1. Status rename: the old terminal 'approved' meant "published".
-- ---------------------------------------------------------------------------
alter type change_request_status rename value 'approved' to 'published';

-- ---------------------------------------------------------------------------
-- 2. Roles
-- ---------------------------------------------------------------------------
insert into roles (key, name, description)
values
  ('qms_coordinator',  'QMS Coordinator',  'Reviews change requests and drafts; runs document control'),
  ('isms_coordinator', 'ISMS Coordinator', 'Reviews change requests and drafts; runs document control')
on conflict (key) do nothing;

update roles set name = 'IMS Manager' where key = 'ims_admin';
update roles set name = 'CTO/VP', description = 'Final approval of controlled documents'
where key = 'approver';

-- Demo accounts, created beforehand in Supabase Auth. Missing accounts are skipped.
insert into profiles (id, full_name, status)
select u.id, v.full_name, 'active'
from auth.users u
join (values
  ('qms-coordinator@ex.com',  'QMS Coordinator'),
  ('isms-coordinator@ex.com', 'ISMS Coordinator'),
  ('cto@ex.com',              'CTO/VP')
) v(email, full_name) on v.email = u.email
on conflict (id) do nothing;

insert into user_roles (profile_id, role_id, department_id)
select u.id, r.id, null
from auth.users u
join (values
  ('qms-coordinator@ex.com',  'qms_coordinator'),
  ('isms-coordinator@ex.com', 'isms_coordinator'),
  ('cto@ex.com',              'approver')
) v(email, role_key) on v.email = u.email
join roles r on r.key = v.role_key
where not exists (
  select 1 from user_roles ur
  where ur.profile_id = u.id and ur.role_id = r.id and ur.department_id is null
);

-- All IMS-side roles read everything. Writes keep using is_ims_admin(), which
-- is unchanged: no INSERT/UPDATE/DELETE policy or write function uses is_ims().
create or replace function public.is_ims()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select has_role(array['ims_admin', 'qms_coordinator', 'isms_coordinator', 'approver']);
$$;

create or replace function public.is_doc_coordinator()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select has_role(array['qms_coordinator', 'isms_coordinator']);
$$;

create or replace function public.is_executive_approver()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select has_role(array['approver']);
$$;

-- ---------------------------------------------------------------------------
-- 3. Tables and columns
-- ---------------------------------------------------------------------------
create table document_types (
  key           text primary key,
  name          text not null,
  display_order smallint,
  created_at    timestamptz not null default now()
);

alter table document_types enable row level security;

create policy document_types_select on document_types
  for select to authenticated using (true);
create policy document_types_insert on document_types
  for insert to authenticated with check (is_ims_admin());
create policy document_types_update on document_types
  for update to authenticated using (is_ims_admin()) with check (is_ims_admin());

grant select, insert, update on document_types to authenticated;

insert into document_types (key, name, display_order) values
  ('manual',           'Manual',           1),
  ('policy',           'Policy',           2),
  ('procedure',        'Procedure',        3),
  ('work_instruction', 'Work Instruction', 4),
  ('form_template',    'Form/Template',    5),
  ('record',           'Record',           6);

alter table documents
  add column document_type text references document_types(key);

alter table document_change_requests
  add column request_type document_request_type not null default 'revision',
  add column supporting_file_url text,
  alter column proposed_revision drop not null;   -- a deletion has none

alter table document_change_requests
  add constraint revision_needed_unless_deletion
  check (request_type = 'deletion' or coalesce(btrim(proposed_revision), '') <> '');

alter table document_revisions
  add column file_url text,
  add column effective_date date;

create table document_drafts (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references document_change_requests(id) on delete restrict,
  draft_number smallint not null,
  file_url     text not null,
  note         text,
  submitted_by uuid not null references profiles(id),
  submitted_at timestamptz not null default now(),
  unique (request_id, draft_number)
);

alter table document_drafts enable row level security;

-- Visible to whoever can see the request (that table's own RLS decides).
create policy document_drafts_select on document_drafts
  for select to authenticated
  using (exists (select 1 from document_change_requests r where r.id = request_id));

grant select on document_drafts to authenticated;
-- No insert/update/delete for clients: submit_draft() writes drafts.

-- Revisions are written only by publish_change_request().
drop policy if exists document_revisions_insert on document_revisions;

-- ---------------------------------------------------------------------------
-- 4. Who may record which decision
-- ---------------------------------------------------------------------------
drop policy if exists document_change_approvals_insert on document_change_approvals;

create policy document_change_approvals_insert on document_change_approvals
  for insert to authenticated
  with check (
    decided_by = auth.uid()
    and (
      (stage = 'owner' and exists (
         select 1 from document_change_requests r
         where r.id = request_id and can_review_document(r.document_id)))
      or (stage in ('coordinator_review', 'draft_check') and is_doc_coordinator())
      or (stage in ('ims', 'ims_document') and is_ims_admin())
      or (stage = 'final' and is_executive_approver())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. The state machine
-- ---------------------------------------------------------------------------
create or replace function public.apply_change_approval()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  req         document_change_requests%rowtype;
  required    change_request_status;
  next_status change_request_status;
begin
  select * into req from document_change_requests where id = new.request_id for update;

  -- Document control is recorded by publish_change_request() / retire_document(),
  -- which move the request themselves.
  if new.stage = 'document_control' then
    if current_setting('ims.applying_approval', true) is distinct from 'on' then
      raise exception 'Document control is recorded by publishing or retiring'
        using errcode = '42501';
    end if;
    return new;
  end if;

  required := case new.stage
    when 'owner'              then 'pending_owner'
    when 'coordinator_review' then 'pending_coordinator'
    when 'ims'                then 'pending_ims'
    when 'draft_check'        then 'pending_draft_check'
    when 'ims_document'       then 'pending_ims_document'
    when 'final'              then 'pending_final'
  end::change_request_status;

  if req.status is distinct from required then
    raise exception 'A % decision requires the request to be %, but it is %',
      new.stage, required, req.status
      using errcode = '23514';
  end if;

  if new.decided_by = req.requester_id then
    raise exception 'You cannot decide a stage of your own request'
      using errcode = '42501';
  end if;

  if new.decision = 'rejected' then
    -- Phase 1 goes back as a request to edit; phase 2 as a draft to redo.
    next_status := case
      when new.stage in ('owner', 'coordinator_review', 'ims') then 'rejected'
      else 'draft_returned'
    end::change_request_status;
  else
    next_status := case new.stage
      when 'owner'              then 'pending_coordinator'
      when 'coordinator_review' then 'pending_ims'
      when 'ims'                then case when req.request_type = 'deletion'
                                          then 'pending_document_control'
                                          else 'awaiting_draft' end
      when 'draft_check'        then 'pending_ims_document'
      when 'ims_document'       then 'pending_final'
      when 'final'              then 'pending_document_control'
    end::change_request_status;
  end if;

  perform set_config('ims.applying_approval', 'on', true);
  update document_change_requests set status = next_status where id = req.id;
  perform set_config('ims.applying_approval', '', true);

  return new;
end;
$$;

create or replace function public.guard_change_request_transition()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  -- Seeds and migrations have no auth.uid(). The workflow functions set the
  -- transaction-local flag before they move a request.
  if auth.uid() is null
     or current_setting('ims.applying_approval', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_owner') then
      raise exception 'A change request starts as draft or pending_owner, not %', new.status
        using errcode = '23514';
    end if;
    if new.requester_id <> auth.uid() then
      raise exception 'A change request can only be raised on your own behalf'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status in ('published', 'retired') then
    raise exception 'A finished change request cannot be changed'
      using errcode = '42501';
  end if;

  -- Only a draft or a phase-1 return can be edited, and only by its requester
  -- (RLS also lets IMS admins through; they may edit the text too).
  if old.status not in ('draft', 'rejected') then
    raise exception 'A request under review is moved by recording a decision, not by editing it'
      using errcode = '42501';
  end if;

  if new.document_id  is distinct from old.document_id
     or new.requester_id is distinct from old.requester_id
     or new.request_type is distinct from old.request_type then
    raise exception 'The document, requester and request type of a request cannot change'
      using errcode = '42501';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if new.status = 'pending_owner' then
    if old.requester_id <> auth.uid() then
      raise exception 'Only the requester can submit a change request'
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'A change request cannot move from % to %', old.status, new.status
    using errcode = '23514';
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Raising a request (new signature: the three new arguments default, so
--    existing named-argument calls keep working until the UI is updated)
-- ---------------------------------------------------------------------------
drop function if exists public.raise_change_request(uuid, text, uuid, text, text, text, text, text, text, text, date);

create function public.raise_change_request(
  p_document_id         uuid,
  p_document_name       text,
  p_department_id       uuid,
  p_document_number     text,
  p_storage_url         text,
  p_proposed_revision   text,
  p_reason              text,
  p_description         text,
  p_affected_processes  text,
  p_iso_refs            text,
  p_effective_date      date,
  p_request_type        document_request_type default null,
  p_document_type       text default null,
  p_supporting_file_url text default null
)
returns uuid
language plpgsql
set search_path to 'public'
as $$
declare
  rtype  document_request_type;
  doc_id uuid := p_document_id;
  doc    documents%rowtype;
  req_id uuid;
begin
  rtype := coalesce(p_request_type,
                    (case when p_document_id is null then 'new' else 'revision' end)::document_request_type);

  if rtype = 'new' then
    if p_document_id is not null then
      raise exception 'A new-document request cannot name an existing document'
        using errcode = '23514';
    end if;
    if coalesce(btrim(p_document_name), '') = '' then
      raise exception 'A new document needs a name' using errcode = '23514';
    end if;
    if p_department_id is null then
      raise exception 'A new document needs a department' using errcode = '23514';
    end if;

    insert into documents (department_id, name, document_number, storage_url, document_type, status)
    values (
      p_department_id,
      btrim(p_document_name),
      nullif(btrim(p_document_number), ''),
      nullif(btrim(p_storage_url), ''),
      nullif(btrim(p_document_type), ''),
      'proposed'
    )
    returning id into doc_id;
  else
    if p_document_id is null then
      raise exception 'A % request needs an existing document', rtype using errcode = '23514';
    end if;
    select * into doc from documents where id = p_document_id;
    if not found or doc.status <> 'active' then
      raise exception 'Only an active document can be revised or retired' using errcode = '23514';
    end if;
    if rtype = 'deletion' and exists (
      select 1 from document_change_requests r
      where r.document_id = p_document_id
        and r.status not in ('published', 'retired', 'rejected', 'draft')
    ) then
      raise exception 'This document already has a change in progress' using errcode = '23514';
    end if;
  end if;

  insert into document_change_requests (
    document_id, requester_id, request_type, proposed_revision,
    reason_for_change, description_of_change, affected_processes,
    related_iso_requirements, proposed_effective_date, supporting_file_url, status
  )
  values (
    doc_id,
    auth.uid(),
    rtype,
    nullif(btrim(p_proposed_revision), ''),
    btrim(p_reason),
    btrim(p_description),
    nullif(btrim(p_affected_processes), ''),
    nullif(btrim(p_iso_refs), ''),
    p_effective_date,
    nullif(btrim(p_supporting_file_url), ''),
    'pending_owner'
  )
  returning id into req_id;

  return req_id;
end;
$$;

grant execute on function public.raise_change_request(uuid, text, uuid, text, text, text, text, text, text, text, date, document_request_type, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Phase 2 draft, publish, retire
-- ---------------------------------------------------------------------------
create or replace function public.submit_draft(
  p_request_id uuid,
  p_file_url   text,
  p_note       text default null
)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  req  document_change_requests%rowtype;
  n    smallint;
  d_id uuid;
begin
  select * into req from document_change_requests where id = p_request_id for update;
  if not found then
    raise exception 'Change request not found' using errcode = 'P0002';
  end if;

  -- A null auth.uid() is a seed acting as the requester.
  if auth.uid() is not null and auth.uid() <> req.requester_id then
    raise exception 'Only the requester can send a draft' using errcode = '42501';
  end if;
  if req.status not in ('awaiting_draft', 'draft_returned') then
    raise exception 'A draft can be sent only after phase 1 is approved or a draft is returned (status is %)', req.status
      using errcode = '23514';
  end if;
  if coalesce(btrim(p_file_url), '') = '' then
    raise exception 'A draft needs a file link' using errcode = '23514';
  end if;

  select coalesce(max(draft_number), 0) + 1 into n
  from document_drafts where request_id = req.id;

  insert into document_drafts (request_id, draft_number, file_url, note, submitted_by)
  values (req.id, n, btrim(p_file_url), nullif(btrim(p_note), ''), req.requester_id)
  returning id into d_id;

  perform set_config('ims.applying_approval', 'on', true);
  update document_change_requests set status = 'pending_draft_check' where id = req.id;
  perform set_config('ims.applying_approval', '', true);

  return d_id;
end;
$$;

create or replace function public.publish_change_request(
  p_request_id      uuid,
  p_revision_label  text,
  p_document_number text default null,
  p_file_url        text default null,
  p_effective_date  date default null,
  p_actor           uuid default null   -- seeds only; ignored for signed-in users
)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  req    document_change_requests%rowtype;
  actor  uuid := coalesce(auth.uid(), p_actor);
  f      text;
  rev_id uuid;
begin
  select * into req from document_change_requests where id = p_request_id for update;
  if not found then
    raise exception 'Change request not found' using errcode = 'P0002';
  end if;

  if auth.uid() is not null and not is_doc_coordinator() then
    raise exception 'Only a QMS or ISMS Coordinator can publish' using errcode = '42501';
  end if;
  if actor is null then
    raise exception 'Publishing needs an actor' using errcode = '42501';
  end if;
  if actor = req.requester_id then
    raise exception 'You cannot decide a stage of your own request' using errcode = '42501';
  end if;
  if req.status <> 'pending_document_control' or req.request_type = 'deletion' then
    raise exception 'Only a new document or revision waiting for document control can be published (status is %)', req.status
      using errcode = '23514';
  end if;
  if coalesce(btrim(p_revision_label), '') = '' then
    raise exception 'Publishing needs a revision label' using errcode = '23514';
  end if;

  f := coalesce(
    nullif(btrim(p_file_url), ''),
    (select d.file_url from document_drafts d
      where d.request_id = req.id order by d.draft_number desc limit 1)
  );
  if f is null then
    raise exception 'Publishing needs the approved file' using errcode = '23514';
  end if;

  perform set_config('ims.applying_approval', 'on', true);

  insert into document_change_approvals (request_id, stage, decision, decided_by)
  values (req.id, 'document_control', 'approved', actor);

  insert into document_revisions (document_id, revision_label, change_request_id,
                                  published_by, file_url, effective_date)
  values (req.document_id, btrim(p_revision_label), req.id,
          actor, f, coalesce(p_effective_date, req.proposed_effective_date))
  returning id into rev_id;

  update documents
  set current_revision = btrim(p_revision_label),
      document_number  = coalesce(nullif(btrim(p_document_number), ''), document_number),
      storage_url      = f,
      status           = case when status = 'proposed' then 'active'::document_status else status end
  where id = req.document_id;

  update document_change_requests set status = 'published' where id = req.id;

  perform set_config('ims.applying_approval', '', true);
  return rev_id;
end;
$$;

create or replace function public.retire_document(
  p_request_id uuid,
  p_actor      uuid default null   -- seeds only; ignored for signed-in users
)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  req   document_change_requests%rowtype;
  actor uuid := coalesce(auth.uid(), p_actor);
begin
  select * into req from document_change_requests where id = p_request_id for update;
  if not found then
    raise exception 'Change request not found' using errcode = 'P0002';
  end if;

  if auth.uid() is not null and not is_doc_coordinator() then
    raise exception 'Only a QMS or ISMS Coordinator can retire a document' using errcode = '42501';
  end if;
  if actor is null then
    raise exception 'Retiring needs an actor' using errcode = '42501';
  end if;
  if actor = req.requester_id then
    raise exception 'You cannot decide a stage of your own request' using errcode = '42501';
  end if;
  if req.status <> 'pending_document_control' or req.request_type <> 'deletion' then
    raise exception 'Only an approved deletion can be retired (status is %)', req.status
      using errcode = '23514';
  end if;

  perform set_config('ims.applying_approval', 'on', true);

  insert into document_change_approvals (request_id, stage, decision, decided_by)
  values (req.id, 'document_control', 'approved', actor);

  update documents set status = 'retired' where id = req.document_id;
  update document_change_requests set status = 'retired' where id = req.id;

  perform set_config('ims.applying_approval', '', true);
end;
$$;

revoke execute on function public.submit_draft(uuid, text, text) from public, anon;
revoke execute on function public.publish_change_request(uuid, text, text, text, date, uuid) from public, anon;
revoke execute on function public.retire_document(uuid, uuid) from public, anon;
grant execute on function public.submit_draft(uuid, text, text) to authenticated;
grant execute on function public.publish_change_request(uuid, text, text, text, date, uuid) to authenticated;
grant execute on function public.retire_document(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Notifications for every stage
-- ---------------------------------------------------------------------------
create or replace function public.notify_change_request()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  recipients   uuid[];
  n_type       notification_type;
  n_link       text;
  to_requester boolean := false;
begin
  if new.status = 'draft' then
    return null;
  end if;

  case new.status
    when 'pending_owner' then
      n_type := 'change_request_awaiting_owner';
      recipients := array(select owner_stage_reviewers(new.document_id));

    when 'pending_coordinator', 'pending_draft_check' then
      n_type := 'change_request_awaiting_coordinator';
      recipients := array(
        select ur.profile_id from user_roles ur join roles r on r.id = ur.role_id
        where r.key in ('qms_coordinator', 'isms_coordinator'));

    when 'pending_document_control' then
      n_type := 'change_request_awaiting_document_control';
      recipients := array(
        select ur.profile_id from user_roles ur join roles r on r.id = ur.role_id
        where r.key in ('qms_coordinator', 'isms_coordinator'));

    when 'pending_ims', 'pending_ims_document' then
      n_type := 'change_request_awaiting_ims';
      recipients := array(
        select ur.profile_id from user_roles ur join roles r on r.id = ur.role_id
        where r.key = 'ims_admin');

    when 'pending_final' then
      n_type := 'change_request_awaiting_final';
      recipients := array(
        select ur.profile_id from user_roles ur join roles r on r.id = ur.role_id
        where r.key = 'approver');

    when 'awaiting_draft' then
      n_type := 'change_request_awaiting_draft';  to_requester := true;
    when 'draft_returned' then
      n_type := 'change_request_draft_returned';  to_requester := true;
    when 'rejected' then
      n_type := 'change_request_returned';        to_requester := true;
    when 'published' then
      n_type := 'change_request_published';       to_requester := true;
    when 'retired' then
      n_type := 'change_request_retired';         to_requester := true;
    else
      return null;
  end case;

  if to_requester then
    recipients := array[new.requester_id];
    n_link := '/department/documents/' || new.document_id;
  else
    -- Nobody is asked to decide their own request.
    recipients := array_remove(recipients, new.requester_id);
    n_link := '/department/approvals';
  end if;

  -- Joining profiles drops inactive people and collapses duplicates; the actor
  -- is never told what they just did (a null actor is a seed: keep everyone).
  insert into notifications (recipient_id, actor_id, type, subject_id, link)
  select p.id, auth.uid(), n_type, new.id, n_link
  from profiles p
  where p.id = any(recipients)
    and p.status = 'active'
    and p.id is distinct from auth.uid();

  return null;
end;
$$;
