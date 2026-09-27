-- =============================================================
-- create_risk_with_baseline(): a risk and its baseline assessment in one
-- transaction
-- =============================================================
--
-- A risk's scores live in risk_assessments, not on the risk. Two PostgREST
-- calls could leave a risk with no baseline if the second insert failed, and
-- there is no delete policy to undo it with. One function cannot: a failure
-- on either insert rolls back both.
--
-- SECURITY INVOKER (the default) on purpose: risks_insert decides who can
-- create (an IMS admin, or a manager of that department), and
-- risk_assessments_insert applies as the caller too. created_by and
-- assessed_by are their auth.uid().
--
-- The baseline is pre-treatment and belongs to no quarter, so its
-- reporting_period_id is null; guard_quarter_lock skips it for that reason.
-- rpn is generated and is not written.
--
-- reference_number is left null. The reports restart it per process every
-- quarter and reuse it; it is a display label, not an identifier.

create or replace function create_risk_with_baseline(
  p_department_id     uuid,
  p_process_id        uuid,     -- null when the risk sits under no process
  p_affected_assets   text,
  p_threat            text,
  p_vulnerability     text,
  p_risk_statement    text,
  p_risk_owner_title  text,
  p_severity          smallint,
  p_likelihood        smallint
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

  return v_risk_id;
end;
$$;

comment on function create_risk_with_baseline(uuid, uuid, text, text, text, text, text, smallint, smallint) is
  'Create a risk and its baseline assessment atomically. Security invoker: RLS applies as the caller. reference_number is left null.';

revoke execute on function create_risk_with_baseline(uuid, uuid, text, text, text, text, text, smallint, smallint) from public, anon;
grant execute on function create_risk_with_baseline(uuid, uuid, text, text, text, text, text, smallint, smallint) to authenticated;
