-- Risk assessments become upsertable, with the same guards as KPI
-- measurements (20260911200651_measurement_write_guards.sql).

-- 1. One residual per risk per period, and one baseline per risk.
--    Baselines have a null reporting_period_id. NULLS NOT DISTINCT (PG 15+;
--    this project runs 17) makes the nulls compare equal, so a single
--    index enforces both rules and gives the upsert its conflict target.
alter table public.risk_assessments
  add constraint risk_assessments_risk_period_key
  unique nulls not distinct (risk_id, reporting_period_id);

-- rpn needs no trigger: it is already
--   generated always as (severity * likelihood) stored
-- (20260827104252_processes_and_risks.sql). Postgres computes it on every
-- insert and update and rejects any client-supplied value, so the app must
-- simply never send it.

-- 2. Insert policy: closed periods are read-only except for IMS admins, and
--    is_ims() narrows to is_ims_admin() so a reviewer cannot write.
--    my_department_ids() stays: recording a score is a Responsible User's
--    job, the same as a KPI measurement.
--    A null reporting_period_id is a baseline, which has no period to be
--    open or closed, and must not be locked out.
alter policy risk_assessments_insert on public.risk_assessments
  with check (
    exists (
      select 1 from risks r
      where r.id = risk_assessments.risk_id
        and (is_ims_admin() or r.department_id in (select my_department_ids()))
    )
    and (
      risk_assessments.reporting_period_id is null
      or exists (
        select 1 from reporting_periods p
        where p.id = risk_assessments.reporting_period_id
          and (p.status = 'open' or is_ims_admin())
      )
    )
  );

-- 3. Update policy. There was none — assessments were append-only. An
--    upsert is checked against INSERT WITH CHECK and UPDATE USING + WITH
--    CHECK, so all three carry the same expression.
create policy risk_assessments_update
  on public.risk_assessments for update
  to authenticated
  using (
    exists (
      select 1 from risks r
      where r.id = risk_assessments.risk_id
        and (is_ims_admin() or r.department_id in (select my_department_ids()))
    )
    and (
      risk_assessments.reporting_period_id is null
      or exists (
        select 1 from reporting_periods p
        where p.id = risk_assessments.reporting_period_id
          and (p.status = 'open' or is_ims_admin())
      )
    )
  )
  with check (
    exists (
      select 1 from risks r
      where r.id = risk_assessments.risk_id
        and (is_ims_admin() or r.department_id in (select my_department_ids()))
    )
    and (
      risk_assessments.reporting_period_id is null
      or exists (
        select 1 from reporting_periods p
        where p.id = risk_assessments.reporting_period_id
          and (p.status = 'open' or is_ims_admin())
      )
    )
  );

-- 4. objective_measurements was left on is_ims() by the 11 September
--    migration. Same narrowing and closed-period condition; its unique
--    constraint already exists.
alter policy objective_measurements_insert on public.objective_measurements
  with check (
    exists (
      select 1 from objectives o
      where o.id = objective_measurements.objective_id
        and (is_ims_admin() or o.department_id in (select my_department_ids()))
    )
    and exists (
      select 1 from reporting_periods p
      where p.id = objective_measurements.reporting_period_id
        and (p.status = 'open' or is_ims_admin())
    )
  );

alter policy objective_measurements_update on public.objective_measurements
  using (
    exists (
      select 1 from objectives o
      where o.id = objective_measurements.objective_id
        and (is_ims_admin() or o.department_id in (select my_department_ids()))
    )
    and exists (
      select 1 from reporting_periods p
      where p.id = objective_measurements.reporting_period_id
        and (p.status = 'open' or is_ims_admin())
    )
  )
  with check (
    exists (
      select 1 from objectives o
      where o.id = objective_measurements.objective_id
        and (is_ims_admin() or o.department_id in (select my_department_ids()))
    )
    and exists (
      select 1 from reporting_periods p
      where p.id = objective_measurements.reporting_period_id
        and (p.status = 'open' or is_ims_admin())
    )
  );
