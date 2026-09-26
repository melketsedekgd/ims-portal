-- =============================================================
-- quarter_reporting_overview: same objective overlap rule
-- =============================================================
--
-- 20260930090200 made department_performance() and quarter_missing_items()
-- count objectives only for the quarters their dates overlap. This is the
-- third function that must agree with them (see 20260925090000), so its
-- obj_due and obj_entered become identical to department_performance()'s,
-- with the period's dates looked up from p_period_id inside each count.
-- Every other column and the where clause are unchanged. Same return
-- type, so CREATE OR REPLACE keeps the grant and the comment.

create or replace function quarter_reporting_overview(p_period_id uuid)
returns table (
  department_id     uuid,
  code              text,
  name              text,
  kpi_due           int,
  kpi_entered       int,
  obj_due           int,
  obj_entered       int,
  risk_due          int,
  risk_reassessed   int,
  last_entry_at     timestamptz,
  status            text,
  submitted_by_name text,
  submitted_at      timestamptz,
  approved_by_name  text,
  approved_at       timestamptz,
  received_by_name  text,
  received_at       timestamptz,
  return_count      int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d.id,
    d.code,
    d.name,

    -- KPIs: quarter_missing_items' population, and its value predicate.
    (select count(*)::int
       from kpis k
      where k.department_id = d.id
        and k.status = 'active')                                as kpi_due,
    (select count(*)::int
       from kpis k
      where k.department_id = d.id
        and k.status = 'active'
        and exists (
          select 1
          from kpi_measurements m
          where m.kpi_id = k.id
            and m.reporting_period_id = p_period_id
            and (
              m.not_measured
              or m.actual_value is not null
              or nullif(btrim(m.actual_text), '') is not null
            )
        ))                                                      as kpi_entered,

    -- Objectives are owed by the quarters their dates overlap (null date =
    -- open-ended; same rule as overlapFilters() in the app).
    -- Due: quarter_missing_items' objective population plus everything
    -- already entered — i.e. entered, plus active non-retired objectives
    -- with no value yet. 'achieved' and 'retired' are only owed a figure if
    -- they already have one: a met objective is finished, but one measured
    -- this quarter still counts, as it does in obj_measured.
    (select count(*)::int
       from objectives o
       join reporting_periods rp on rp.id = p_period_id
      where o.department_id = d.id
        and (o.start_date is null or o.start_date <= rp.end_date)
        and (o.target_date is null or o.target_date >= rp.start_date)
        and (
          exists (
            select 1
            from objective_measurements om
            where om.objective_id = o.id
              and om.reporting_period_id = rp.id
              and (om.not_measured or om.achievement is not null)
          )
          or (o.status = 'active' and o.retired_at is null)
        ))                                                   as obj_due,
    -- Entered: every overlapping objective with a value for the quarter
    -- (a number or an explicit not_measured), whatever its status.
    (select count(*)::int
       from objectives o
       join reporting_periods rp on rp.id = p_period_id
      where o.department_id = d.id
        and (o.start_date is null or o.start_date <= rp.end_date)
        and (o.target_date is null or o.target_date >= rp.start_date)
        and exists (
          select 1
          from objective_measurements om
          where om.objective_id = o.id
            and om.reporting_period_id = rp.id
            and (om.not_measured or om.achievement is not null)
        ))                                                   as obj_entered,

    -- Risks: 'active' is not one of the four status values; the register's
    -- own rule is "not retired", and a closed risk still carries a score
    -- worth re-checking.
    (select count(*)::int
       from risks r
      where r.department_id = d.id
        and r.status <> 'retired')                              as risk_due,
    -- 'residual' is what the risk pages write each quarter. A 'baseline'
    -- assessment is pre-treatment and has a null reporting_period_id, so
    -- it could never match this period anyway -- named explicitly so the
    -- reason is on the page rather than in the data.
    (select count(*)::int
       from risks r
      where r.department_id = d.id
        and r.status <> 'retired'
        and exists (
          select 1
          from risk_assessments ra
          where ra.risk_id = r.id
            and ra.reporting_period_id = p_period_id
            and ra.type = 'residual'
        ))                                                      as risk_reassessed,

    -- The last time anyone touched this quarter's figures. greatest()
    -- ignores nulls and returns null only when all three are null, which
    -- is exactly "nothing entered yet".
    greatest(
      (select max(m.updated_at)
         from kpi_measurements m
         join kpis k on k.id = m.kpi_id
        where k.department_id = d.id
          and m.reporting_period_id = p_period_id),
      (select max(om.updated_at)
         from objective_measurements om
         join objectives o on o.id = om.objective_id
        where o.department_id = d.id
          and om.reporting_period_id = p_period_id),
      (select max(ra.assessed_at)
         from risk_assessments ra
         join risks r on r.id = ra.risk_id
        where r.department_id = d.id
          and ra.reporting_period_id = p_period_id)
    )                                                           as last_entry_at,

    -- No row is the same as open, the same reading record_quarter_decision
    -- takes when it decides what a department may do next.
    coalesce(qs.status::text, 'open')                           as status,
    sub.full_name                                               as submitted_by_name,
    qs.submitted_at,
    app.full_name                                               as approved_by_name,
    qs.approved_at,
    rec.full_name                                               as received_by_name,
    qs.received_at,
    coalesce((select count(*)::int
                from quarter_signoff_decisions qd
               where qd.signoff_id = qs.id
                 and qd.decision = 'return'), 0)                as return_count

  from departments d
  left join quarter_signoffs qs
         on qs.department_id = d.id
        and qs.reporting_period_id = p_period_id
  left join profiles sub on sub.id = qs.submitted_by
  left join profiles app on app.id = qs.approved_by
  left join profiles rec on rec.id = qs.received_by
  where d.takes_part_in_signoff
    -- A soft-deleted department is not owed a quarter. Nothing is ever
    -- DELETEd here, so without this the tracker would keep chasing
    -- departments that closed years ago.
    and d.status <> 'inactive'
    and (is_ims() or d.id in (select my_department_ids()))
  order by d.name;
$$;
