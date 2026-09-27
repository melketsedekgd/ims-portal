-- =============================================================
-- create_risk_with_baseline(): the risk's treatment in the same transaction
-- =============================================================
--
-- Every risk on the real reports has a treatment. A risk without one has
-- nothing for its quarterly residual score to measure against, never shows
-- up as work on the Actions page (v_open_action_items reads planned and
-- in-progress treatments), and can never become overdue. There is no
-- "accept the risk" option, so a new risk is created with its treatment or
-- not at all.
--
-- Postgres cannot add parameters to an existing function — a different
-- argument list is a different function — so the 9-argument version is
-- dropped and the 15-argument one created in its place. The first nine
-- parameters, their checks and their error messages are unchanged.
--
-- Still SECURITY INVOKER: risk_treatments_insert inherits from the parent
-- risk (an IMS admin, or a manager of its department), the same people
-- risks_insert already lets through. created_by is the caller's auth.uid().
--
-- A new treatment is 'planned' or 'in_progress'. 'completed' needs a
-- completed_date and review history, and 'cancelled' would be a risk with
-- no live treatment — the state this change exists to prevent.
--
-- target >= start is also the valid_dates CHECK on risk_treatments; it is
-- tested here first so the message says which field is wrong.

drop function create_risk_with_baseline(uuid, uuid, text, text, text, text, text, smallint, smallint);

create function create_risk_with_baseline(
  p_department_id           uuid,
  p_process_id              uuid,     -- null when the risk sits under no process
  p_affected_assets         text,
  p_threat                  text,
  p_vulnerability           text,
  p_risk_statement          text,
  p_risk_owner_title        text,
  p_severity                smallint,
  p_likelihood              smallint,
  p_treatment_solution      text,
  p_monitoring_evidence     text,
  p_treatment_owner_title   text,
  p_treatment_start         date,     -- null when no start date is planned
  p_treatment_target        date,
  p_treatment_status        treatment_status
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_risk_id uuid;
begin
  if p_severity is null or p_severity not between 1 and 5 then
    raise exception 'Severity must be between 1 and 5, got %', coalesce(p_severity::text, 'null')
      using errcode = '23514';
  end if;

  if p_likelihood is null or p_likelihood not between 1 and 5 then
    raise exception 'Likelihood must be between 1 and 5, got %', coalesce(p_likelihood::text, 'null')
      using errcode = '23514';
  end if;

  if coalesce(btrim(p_affected_assets), '') = '' then
    raise exception 'A risk needs affected assets'
      using errcode = '23514';
  end if;

  if coalesce(btrim(p_treatment_solution), '') = '' then
    raise exception 'A risk needs a treatment solution'
      using errcode = '23514';
  end if;

  if p_treatment_target is null then
    raise exception 'A treatment needs a target date'
      using errcode = '23514';
  end if;

  if p_treatment_start is not null and p_treatment_target < p_treatment_start then
    raise exception 'The treatment target date (%) is before its start date (%)', p_treatment_target, p_treatment_start
      using errcode = '23514';
  end if;

  if p_treatment_status is null or p_treatment_status not in ('planned', 'in_progress') then
    raise exception 'A new treatment must be planned or in progress, got %', coalesce(p_treatment_status::text, 'null')
      using errcode = '23514';
  end if;

  -- Read as the caller, so a process they cannot see reads as not belonging.
  if p_process_id is not null and not exists (
    select 1
    from processes
    where id = p_process_id
      and department_id = p_department_id
  ) then
    raise exception 'Process % does not belong to department %', p_process_id, p_department_id
      using errcode = '23514';
  end if;

  insert into risks (
    department_id,
    process_id,
    reference_number,
    affected_assets,
    threat,
    vulnerability,
    risk_statement,
    risk_owner_title,
    status,
    created_by
  )
  values (
    p_department_id,
    p_process_id,
    null,
    btrim(p_affected_assets),
    nullif(btrim(p_threat), ''),
    nullif(btrim(p_vulnerability), ''),
    nullif(btrim(p_risk_statement), ''),
    nullif(btrim(p_risk_owner_title), ''),
    'open',
    auth.uid()
  )
  returning id into v_risk_id;

  insert into risk_assessments (
    risk_id,
    reporting_period_id,
    type,
    severity,
    likelihood,
    assessed_by
  )
  values (
    v_risk_id,
    null,
    'baseline'::assessment_type,
    p_severity,
    p_likelihood,
    auth.uid()
  );

  insert into risk_treatments (
    risk_id,
    treatment_solution,
    monitoring_evidence,
    owner_title,
    start_date,
    target_date,
    status,
    created_by
  )
  values (
    v_risk_id,
    btrim(p_treatment_solution),
    nullif(btrim(p_monitoring_evidence), ''),
    nullif(btrim(p_treatment_owner_title), ''),
    p_treatment_start,
    p_treatment_target,
    p_treatment_status,
    auth.uid()
  );

  return v_risk_id;
end;
$$;

comment on function create_risk_with_baseline(uuid, uuid, text, text, text, text, text, smallint, smallint, text, text, text, date, date, treatment_status) is
  'Create a risk, its baseline assessment and its treatment atomically. Security invoker: RLS applies as the caller. reference_number is left null.';

revoke execute on function create_risk_with_baseline(uuid, uuid, text, text, text, text, text, smallint, smallint, text, text, text, date, date, treatment_status) from public, anon;
grant execute on function create_risk_with_baseline(uuid, uuid, text, text, text, text, text, smallint, smallint, text, text, text, date, date, treatment_status) to authenticated;
