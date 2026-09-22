-- =============================================================
-- Quarter sign-off: the tables and the one decision path
-- =============================================================
--
-- Today a department's quarter stays editable until IMS closes the whole
-- period for everyone. The paper report is signed per department, so the
-- lock has to be per department too.
--
-- No row means open. Rows are created by the RPC on first submit and
-- nothing is seeded: a department that never submitted is indistinguishable
-- from one that has no row, and inventing rows for every (department,
-- quarter) pair would put a sign-off record against quarters nobody worked.

create table quarter_signoffs (
  id                   uuid primary key default gen_random_uuid(),
  department_id        uuid not null references departments(id),
  reporting_period_id  uuid not null references reporting_periods(id),
  status               signoff_status not null default 'open',

  -- Prepared by / Approved by / Received by, in that order.
  submitted_by         uuid references profiles(id),
  submitted_at         timestamptz,
  approved_by          uuid references profiles(id),
  approved_at          timestamptz,
  received_by          uuid references profiles(id),
  received_at          timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint quarter_signoffs_department_period_key
    unique (department_id, reporting_period_id)
);

create trigger quarter_signoffs_set_updated_at
  before update on quarter_signoffs
  for each row execute function set_updated_at();

-- Insert-only history. Who did what, when, and why it came back.
create table quarter_signoff_decisions (
  id          uuid primary key default gen_random_uuid(),
  signoff_id  uuid not null references quarter_signoffs(id) on delete restrict,
  decision    signoff_decision not null,
  decided_by  uuid not null references profiles(id),
  reason      text,
  created_at  timestamptz not null default now()
);

create index quarter_signoff_decisions_signoff_idx
  on quarter_signoff_decisions (signoff_id, created_at);


-- -------------------------------------------------------------
-- RLS: read your own department, or everything if you are IMS
-- -------------------------------------------------------------
--
-- No insert, update or delete policy on either table. Every write goes
-- through record_quarter_decision(), which is security definer, so these
-- are the only two statements a client can run against them.
--
-- is_ims() rather than is_ims_admin(): a reviewer reads, which is the whole
-- of what a reviewer does.

alter table quarter_signoffs          enable row level security;
alter table quarter_signoff_decisions enable row level security;

create policy quarter_signoffs_select
  on quarter_signoffs for select
  to authenticated
  using (is_ims() or department_id in (select my_department_ids()));

create policy quarter_signoff_decisions_select
  on quarter_signoff_decisions for select
  to authenticated
  using (
    exists (
      select 1 from quarter_signoffs s
      where s.id = quarter_signoff_decisions.signoff_id
        and (is_ims() or s.department_id in (select my_department_ids()))
    )
  );

revoke all on quarter_signoffs          from anon, authenticated;
revoke all on quarter_signoff_decisions from anon, authenticated;
grant select on quarter_signoffs          to authenticated;
grant select on quarter_signoff_decisions to authenticated;


-- -------------------------------------------------------------
-- record_quarter_decision(): the only way a quarter moves
-- -------------------------------------------------------------
--
-- One function rather than four, and a function rather than policies on the
-- tables, because "who may do what from which state" is a single set of
-- rules and splitting it is how the halves drift apart. A policy is also
-- the wrong shape for it: the rule for each decision depends on the
-- caller's role in one specific department, which an expression over the
-- row being written says badly.
--
-- Security definer, so it checks auth.uid() itself rather than leaning on
-- RLS that the tables deliberately do not have.
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
      v_next := 'submitted';

    when 'return' then
      if v_current <> 'submitted' then
        raise exception 'Only a submitted quarter can be returned; this one is %',
          v_current using errcode = '23514';
      end if;
      if p_department_id not in (select my_managed_department_ids()) then
        raise exception 'Only the manager of that department may return its quarter'
          using errcode = '42501';
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
    -- signature that belonged to an earlier version of the quarter.
    approved_by  = case when p_decision = 'submit'  then null
                        when p_decision = 'approve' then v_actor
                        else quarter_signoffs.approved_by end,
    approved_at  = case when p_decision = 'submit'  then null
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

comment on function record_quarter_decision(uuid, uuid, signoff_decision, text) is
  'The only path that moves a department quarter between open, submitted, returned, approved and received. Checks the caller itself; the tables carry no write policies.';

revoke execute on function record_quarter_decision(uuid, uuid, signoff_decision, text) from public;
revoke execute on function record_quarter_decision(uuid, uuid, signoff_decision, text) from anon;
grant  execute on function record_quarter_decision(uuid, uuid, signoff_decision, text) to authenticated;
