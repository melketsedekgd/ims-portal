-- =============================================================
-- Departments opt out of quarterly sign-off; IMS is excluded
-- =============================================================
--
-- IMS takes no part in sign-off. It is the body the quarters are signed
-- off *to*: it receives them, returns them and keeps the trail. A quarter
-- IMS submitted to itself and approved for itself would be a signature on
-- its own homework, and the tracker that lists who still owes a quarter
-- has no row for the department doing the tracking.
--
-- Hiding the buttons is not enough. record_quarter_decision is reachable
-- over PostgREST by anyone signed in, so the refusal belongs in the
-- database. Today an IMS submit already fails, but only incidentally --
-- with 42501 'Only a contributor or manager in that department may
-- submit', because nobody happens to hold a department role in IMS. Grant
-- one contributor role and that door opens. This closes it on purpose.
--
-- A flag on departments rather than a hardcoded 'IMS': whether a
-- department signs off is a fact about the department, and MMCY will have
-- others that do not (a shared-services unit with no processes of its
-- own). One column answers it for all of them.

-- -------------------------------------------------------------
-- 1. The column
-- -------------------------------------------------------------

alter table departments
  add column takes_part_in_signoff boolean not null default true;

comment on column departments.takes_part_in_signoff is
  'Whether this department submits a quarter for sign-off. False for IMS, '
  'which receives quarters rather than submitting them. Enforced by '
  'record_quarter_decision and honoured by quarter_reporting_overview.';

-- Every existing department signs off except IMS, which is why the column
-- defaults to true rather than being backfilled per row.
update departments set takes_part_in_signoff = false where code = 'IMS';

-- -------------------------------------------------------------
-- 2. record_quarter_decision: one new check, nothing else
-- -------------------------------------------------------------
--
-- Reproduced verbatim from 20260923090000 with a single block added, at
-- the top of the validation sequence. It sits after the signed-in check
-- and before the period lookup: being signed in stays the first gate, and
-- the department's own fitness for sign-off is settled before any work is
-- done on the period or any row is locked.
--
-- 23514 is the errcode the other "this decision does not apply here"
-- refusals already use -- wrong period type, wrong period status, a
-- return with no reason -- because this is the same kind of refusal: not
-- a permission the caller lacks, but a decision that does not exist for
-- this department.
create or replace function record_quarter_decision(
  p_department_id uuid,
  p_period_id     uuid,
  p_decision      signoff_decision,
  p_reason        text default null
)
returns quarter_signoffs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_period  reporting_periods%rowtype;
  v_signoff quarter_signoffs%rowtype;
  v_current signoff_status;
  v_next    signoff_status;
begin
  if v_actor is null then
    raise exception 'You must be signed in to record a sign-off decision'
      using errcode = '42501';
  end if;

  -- IMS receives quarters; it does not submit them. A department opted out
  -- of sign-off has no decision to record, whoever is asking and whatever
  -- they are asking for.
  if not (select d.takes_part_in_signoff from departments d where d.id = p_department_id) then
    raise exception 'This department does not take part in quarterly sign-off'
      using errcode = '23514';
  end if;

  select * into v_period from reporting_periods where id = p_period_id;
  if not found then
    raise exception 'No such reporting period' using errcode = '23503';
  end if;

  -- Sign-off is a quarterly ritual. A month or the annual period has no
  -- signed report behind it, and Q1/Q2 are already frozen by their closed
  -- status, which is a different lock with a different owner.
  if v_period.type <> 'quarterly' then
    raise exception 'Sign-off applies to quarterly periods only; % is %',
      v_period.label, v_period.type using errcode = '23514';
  end if;
  if v_period.status <> 'open' then
    raise exception 'Sign-off applies to open periods only; % is %',
      v_period.label, v_period.status using errcode = '23514';
  end if;

  -- Locked for the duration: two reviewers deciding at once would otherwise
  -- both read 'submitted' and both write.
  select * into v_signoff
    from quarter_signoffs
   where department_id = p_department_id
     and reporting_period_id = p_period_id
   for update;

  -- No row is the same as open. That is what lets the first submit create
  -- the row rather than needing one seeded ahead of it.
  v_current := coalesce(v_signoff.status, 'open');

  case p_decision

    when 'submit' then
      if v_current not in ('open', 'returned') then
        raise exception 'A quarter can only be submitted while it is open or returned; this one is %',
          v_current using errcode = '23514';
      end if;
      -- Explicit role keys, not my_department_ids(): that helper answers
      -- "has any scoped role here", which is how a read-only role once
      -- acquired write access elsewhere in this schema.
      if not exists (
        select 1
        from user_roles ur
        join roles r on r.id = ur.role_id
        where ur.profile_id = v_actor
          and ur.department_id = p_department_id
          and r.key in ('department_contributor', 'department_manager')
      ) then
        raise exception 'Only a contributor or manager in that department may submit its quarter'
          using errcode = '42501';
      end if;
      -- The completeness rule lives here, with the other submit rules, rather
      -- than in the page that calls this. A quarter signed off with blank KPIs
      -- is the failure this whole batch exists to prevent, and a check that
      -- only the UI performs is one `curl` away from being skipped.
      if exists (select 1 from quarter_missing_items(p_department_id, p_period_id)) then
        raise exception 'quarter_incomplete: % KPI(s) and % objective(s) have no value for this quarter',
          (select count(*) from quarter_missing_items(p_department_id, p_period_id) where kind = 'kpi'),
          (select count(*) from quarter_missing_items(p_department_id, p_period_id) where kind = 'objective')
          using errcode = 'P0001';
      end if;
      v_next := 'submitted';

    when 'return' then
      -- Two doors into the same state, and which one you may use depends on
      -- where the quarter is standing.
      if v_current not in ('submitted', 'approved') then
        raise exception 'Only a submitted or approved quarter can be returned; this one is %',
          v_current using errcode = '23514';
      end if;
      if v_current = 'submitted' then
        if p_department_id not in (select my_managed_department_ids()) then
          raise exception 'Only the manager of that department may return its quarter'
            using errcode = '42501';
        end if;
      else
        -- The same check the 'receive' branch makes, because this is the
        -- other half of the same decision: once a quarter is approved it is
        -- IMS's to accept or to send back, and nobody else's. A manager
        -- who wants their own approval undone asks IMS.
        if not is_ims_admin() then
          raise exception 'Only an IMS administrator may return an approved quarter'
            using errcode = '42501';
        end if;
      end if;
      -- A return with no reason is not something the submitter can act on.
      if coalesce(btrim(p_reason), '') = '' then
        raise exception 'A reason is required to return a quarter'
          using errcode = '23514';
      end if;
      v_next := 'returned';

    when 'approve' then
      if v_current <> 'submitted' then
        raise exception 'Only a submitted quarter can be approved; this one is %',
          v_current using errcode = '23514';
      end if;
      if p_department_id not in (select my_managed_department_ids()) then
        raise exception 'Only the manager of that department may approve its quarter'
          using errcode = '42501';
      end if;
      -- Approving your own submission is allowed here. A manager in a
      -- one-person department has nobody else to ask, and refusing it in
      -- the database would stop the quarter dead. It is visible in
      -- quarter_signoff_decisions either way.
      v_next := 'approved';

    when 'receive' then
      if v_current <> 'approved' then
        raise exception 'Only an approved quarter can be received; this one is %',
          v_current using errcode = '23514';
      end if;
      if not is_ims_admin() then
        raise exception 'Only an IMS administrator may receive a quarter'
          using errcode = '42501';
      end if;
      v_next := 'received';

  end case;

  insert into quarter_signoffs (
    department_id, reporting_period_id, status,
    submitted_by, submitted_at, approved_by, approved_at, received_by, received_at
  )
  values (
    p_department_id, p_period_id, v_next,
    case when p_decision = 'submit'  then v_actor end,
    case when p_decision = 'submit'  then now()   end,
    case when p_decision = 'approve' then v_actor end,
    case when p_decision = 'approve' then now()   end,
    case when p_decision = 'receive' then v_actor end,
    case when p_decision = 'receive' then now()   end
  )
  on conflict (department_id, reporting_period_id) do update set
    status       = v_next,
    submitted_by = case when p_decision = 'submit'  then v_actor
                        else quarter_signoffs.submitted_by end,
    submitted_at = case when p_decision = 'submit'  then now()
                        else quarter_signoffs.submitted_at end,
    -- A resubmission drops the previous approval rather than carrying a
    -- signature that belonged to an earlier version of the quarter, and a
    -- return now drops it for the same reason: the quarter is back with
    -- the department, so the trail must not still show it as approved.
    -- Nulling on every return rather than only on a return from 'approved'
    -- is the same thing by a shorter route -- a 'submitted' quarter has
    -- already had approved_by nulled by the submit that produced it.
    -- quarter_signoff_decisions keeps the approval that was undone.
    approved_by  = case when p_decision in ('submit', 'return') then null
                        when p_decision = 'approve' then v_actor
                        else quarter_signoffs.approved_by end,
    approved_at  = case when p_decision in ('submit', 'return') then null
                        when p_decision = 'approve' then now()
                        else quarter_signoffs.approved_at end,
    received_by  = case when p_decision = 'receive' then v_actor
                        else quarter_signoffs.received_by end,
    received_at  = case when p_decision = 'receive' then now()
                        else quarter_signoffs.received_at end
  returning * into v_signoff;

  insert into quarter_signoff_decisions (signoff_id, decision, decided_by, reason)
  values (v_signoff.id, p_decision, v_actor, nullif(btrim(p_reason), ''));

  return v_signoff;
end;
$$;
