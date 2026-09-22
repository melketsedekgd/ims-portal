-- =============================================================
-- Sign-off completeness: what is still blank, and a gate on submit
-- =============================================================
--
-- Batch 1 put every sign-off rule inside record_quarter_decision(). This is
-- one more of those rules, so it goes in the same place rather than in the
-- page that calls it: a quarter signed off with blank KPIs is the failure
-- this work exists to prevent, and a check only the UI performs is one
-- request away from being skipped.
--
-- Risks are deliberately not part of completeness. A baseline assessment
-- has no period at all, and residuals follow a different cadence; requiring
-- one per quarter would be a policy change, not a completeness check. The
-- review page shows them read-only so a reviewer can still see them.

-- What is still blank for a department in a period.
--
-- SECURITY INVOKER on purpose, and it reads differently depending on who
-- asks. Called from the page, RLS scopes it to the KPIs the caller can see,
-- which is exactly the checklist they should get. Called from inside
-- record_quarter_decision(), current_user is already the definer, so the
-- gate counts every KPI in the department whether or not the submitter can
-- read them all.
--
-- "Has a value" is deliberately generous: a number, some text, or an
-- explicit not_measured all count. not_measured is a real answer — it is
-- how the reports say "no data this quarter" — and refusing to accept it
-- would make the checklist unclearable. Whitespace-only text is not an
-- answer, hence the btrim.
create or replace function quarter_missing_items(
  p_department_id uuid,
  p_period_id     uuid
)
returns table (kind text, item_id uuid, name text)
language sql
stable
security invoker
set search_path = public
as $$
  select t.kind, t.item_id, t.name
  from (
    select
      'kpi'::text as kind,
      k.id        as item_id,
      k.name      as name,
      0           as kind_order,
      -- display_order is scoped per process, so the process has to come
      -- first or KPIs from unrelated processes interleave.
      coalesce(pr.display_order, 2147483647) as ord1,
      coalesce(k.display_order, 2147483647)  as ord2,
      k.name                                 as ord3
    from kpis k
    left join processes pr on pr.id = k.process_id
    where k.department_id = p_department_id
      and k.status = 'active'
      and not exists (
        select 1
        from kpi_measurements m
        where m.kpi_id = k.id
          and m.reporting_period_id = p_period_id
          and (
            m.not_measured
            or m.actual_value is not null
            or nullif(btrim(m.actual_text), '') is not null
          )
      )

    union all

    select
      'objective'::text,
      o.id,
      o.title,
      1,
      coalesce(o.reference_number, 32767),
      0,
      o.title
    from objectives o
    where o.department_id = p_department_id
      -- 'achieved' is excluded along with 'retired'. An objective that has
      -- been met is finished, and holding a quarter open for it would give
      -- the department no way to clear the checklist.
      and o.status = 'active'
      and o.retired_at is null
      and not exists (
        select 1
        from objective_measurements om
        where om.objective_id = o.id
          and om.reporting_period_id = p_period_id
          and (om.not_measured or om.achievement is not null)
      )
  ) t
  order by t.kind_order, t.ord1, t.ord2, t.ord3;
$$;

comment on function quarter_missing_items(uuid, uuid) is
  'KPIs and objectives in a department with no value recorded for a period. Drives the sign-off checklist and gates submit.';

revoke execute on function quarter_missing_items(uuid, uuid) from public;
revoke execute on function quarter_missing_items(uuid, uuid) from anon;
grant  execute on function quarter_missing_items(uuid, uuid) to authenticated;


-- -------------------------------------------------------------
-- record_quarter_decision(): the submit branch gains the gate
-- -------------------------------------------------------------
--
-- Recreated from the live definition with one insertion in the submit
-- branch and no other change. Every other branch, the locking select, the
-- upsert and the decision insert are byte-for-byte what batch 1 shipped.

CREATE OR REPLACE FUNCTION public.record_quarter_decision(p_department_id uuid, p_period_id uuid, p_decision signoff_decision, p_reason text DEFAULT NULL::text)
 RETURNS quarter_signoffs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

comment on function record_quarter_decision(uuid, uuid, signoff_decision, text) is
  'The only path that moves a department quarter between open, submitted, returned, approved and received. Checks the caller itself; the tables carry no write policies. Submit additionally requires every active KPI and objective to have a value for the period.';

revoke execute on function record_quarter_decision(uuid, uuid, signoff_decision, text) from public;
revoke execute on function record_quarter_decision(uuid, uuid, signoff_decision, text) from anon;
grant  execute on function record_quarter_decision(uuid, uuid, signoff_decision, text) to authenticated;
