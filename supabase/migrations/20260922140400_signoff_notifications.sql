-- =============================================================
-- Sign-off notifications
-- =============================================================
--
-- Same shape as notify_change_request(): written by a trigger in the same
-- transaction as the status change, so a rolled-back decision takes its
-- notification with it, and carrying nothing but a recipient, a type, a
-- link and a subject id. No figures, no department name, no reason — which
-- is what lets the email pass send these without an IMS report reaching a
-- mail provider.
--
-- The link points at /sign-off/<id>, a page that arrives in batch 2. A
-- notification whose link 404s for a day is a smaller problem than a
-- decision nobody was told about.
create or replace function notify_quarter_signoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipients uuid[];
  n_type     notification_type;
begin
  case new.status

    when 'submitted' then
      n_type := 'quarter_submitted';
      recipients := array(
        select ur.profile_id
        from user_roles ur
        join roles r on r.id = ur.role_id
        where r.key = 'department_manager'
          and ur.department_id = new.department_id
      );

    when 'returned' then
      n_type := 'quarter_returned';
      recipients := array[new.submitted_by];

    when 'approved' then
      n_type := 'quarter_approved';
      recipients := array(
        select ur.profile_id
        from user_roles ur
        join roles r on r.id = ur.role_id
        where r.key = 'ims_admin'
      );

    when 'received' then
      n_type := 'quarter_received';
      -- Both signatures on the paper form. When one person did both, the
      -- profiles join below collapses them to a single notification.
      recipients := array[new.submitted_by, new.approved_by];

    else
      -- 'open' is where a quarter starts, not somewhere it is moved to.
      return null;

  end case;

  -- The same filter notify_change_request() uses, and for the same three
  -- reasons: it drops inactive people, it collapses duplicates, and it
  -- keeps the bell from telling you what you just did. A null auth.uid()
  -- is a migration with no actor, and "is distinct from" keeps everyone in
  -- that case rather than dropping all of them.
  insert into notifications (recipient_id, actor_id, type, subject_id, link)
  select p.id, auth.uid(), n_type, new.id, '/sign-off/' || new.id
  from profiles p
  where p.id = any(recipients)
    and p.status = 'active'
    and p.id is distinct from auth.uid();

  return null;
end;
$$;

comment on function notify_quarter_signoff() is
  'Writes notifications when a department quarter changes state. Same transaction as the change, by design.';

-- The first submit creates the row already at 'submitted', so an
-- UPDATE-only trigger would miss every quarter's first move — the same
-- reason the change request trigger needs both.
create trigger quarter_signoffs_notify_insert
  after insert on quarter_signoffs
  for each row
  when (new.status <> 'open')
  execute function notify_quarter_signoff();

create trigger quarter_signoffs_notify_update
  after update of status on quarter_signoffs
  for each row
  when (old.status is distinct from new.status)
  execute function notify_quarter_signoff();
