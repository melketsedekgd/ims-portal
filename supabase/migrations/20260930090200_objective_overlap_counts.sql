-- =============================================================
-- Objectives are owed by the quarters they overlap
-- =============================================================
--
-- Objective due/entered counts ignored dates. Every 2025 objective is now
-- 'achieved' or 'retired', so 2025 quarters were counting the 2026
-- objectives instead ("0 of 4 entered"). And an achieved objective that was
-- measured in a quarter fell out of due/entered while obj_measured still
-- counted it.
--
-- Both functions now use the overlap rule from overlapFilters() in
-- features/objectives/queries.ts, null date = open-ended:
--   (start_date is null or start_date <= period end)
--   and (target_date is null or target_date >= period start)
--
-- quarter_missing_items(): the objective branch gains the overlap rule;
-- everything else is unchanged.
-- department_performance(): obj_entered is every overlapping objective with
-- a value for the quarter, whatever its status; obj_due is that plus
-- quarter_missing_items' objective rows. Nothing else changes. Same return
-- type, so CREATE OR REPLACE keeps the grants and comments.

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
    join reporting_periods rp on rp.id = p_period_id
    where o.department_id = p_department_id
      -- Only objectives whose dates overlap the period; a null date is
      -- open-ended. Same rule as overlapFilters() in the app.
      and (o.start_date is null or o.start_date <= rp.end_date)
      and (o.target_date is null or o.target_date >= rp.start_date)
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

create or replace function department_performance(p_year int)
returns table (
  department_id        uuid,
  code                 text,
  name                 text,
  period_id            uuid,
  quarter              text,
  kpi_measured         int,
  kpi_on_target        int,
  kpi_due              int,
  kpi_entered          int,
  obj_measured         int,
  obj_achievement_avg  numeric,
  obj_due              int,
  obj_entered          int,
  risks_active         int,
  risk_scores          int[]
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
    rp.id,
    rp.label,

    -- Measured: a number was recorded. A recorded "not measured" is an
    -- answer but not a measurement, so it is in neither the numerator nor
    -- the denominator of the score.
    (select count(*)::int
       from kpi_measurements m
       join kpis k on k.id = m.kpi_id
      where k.department_id = d.id
        and m.reporting_period_id = rp.id
        and not m.not_measured
        and (
          m.actual_value is not null
          or nullif(btrim(m.actual_text), '') is not null
        ))                                                  as kpi_measured,

    -- kpi_achievement_ratio(), never kpi_computed_ratio(): the second
    -- ignores a manager's override. The ratio is capped at 1 by least(),
    -- so >= 1 is "hit the target or better"; an override is stored
    -- uncapped, which is why this is >= 1 and not = 1.
    (select count(*)::int
       from kpi_measurements m
       join kpis k on k.id = m.kpi_id
      where k.department_id = d.id
        and m.reporting_period_id = rp.id
        and not m.not_measured
        and (
          m.actual_value is not null
          or nullif(btrim(m.actual_text), '') is not null
        )
        and kpi_achievement_ratio(m.*) >= 1)                 as kpi_on_target,

    -- Due and entered: quarter_missing_items' population and its "has a
    -- value" predicate, verbatim. Entered counts a recorded "not measured"
    -- as an answer — the department has said its piece — which is why it
    -- can exceed kpi_measured above.
    (select count(*)::int
       from kpis k
      where k.department_id = d.id
        and k.status = 'active')                             as kpi_due,
    (select count(*)::int
       from kpis k
      where k.department_id = d.id
        and k.status = 'active'
        and exists (
          select 1
          from kpi_measurements m
          where m.kpi_id = k.id
            and m.reporting_period_id = rp.id
            and (
              m.not_measured
              or m.actual_value is not null
              or nullif(btrim(m.actual_text), '') is not null
            )
        ))                                                   as kpi_entered,

    (select count(*)::int
       from objective_measurements om
       join objectives o on o.id = om.objective_id
      where o.department_id = d.id
        and om.reporting_period_id = rp.id
        and not om.not_measured
        and om.achievement is not null)                      as obj_measured,

    -- Stored as a 0..1 fraction and returned as one. Rounded here rather
    -- than in TypeScript so the query and the screen agree.
    (select round(avg(om.achievement), 4)
       from objective_measurements om
       join objectives o on o.id = om.objective_id
      where o.department_id = d.id
        and om.reporting_period_id = rp.id
        and not om.not_measured
        and om.achievement is not null)                      as obj_achievement_avg,

    -- Objectives are owed by the quarters their dates overlap (null date =
    -- open-ended; same rule as overlapFilters() in the app).
    -- Due: quarter_missing_items' objective population plus everything
    -- already entered — i.e. entered, plus active non-retired objectives
    -- with no value yet. 'achieved' and 'retired' are only owed a figure if
    -- they already have one: a met objective is finished, but one measured
    -- this quarter still counts, as it does in obj_measured.
    (select count(*)::int
       from objectives o
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

    -- A risk has no period of its own, so this is a "now" count repeated
    -- against each quarter. 'active' is not one of the four status values;
    -- the register's rule is "not retired", and that is the rule here.
    (select count(*)::int
       from risks r
      where r.department_id = d.id
        and r.status <> 'retired')                           as risks_active,

    -- The residual scores for this period, over the same population
    -- risks_active counts, so risks_active minus the array's length is
    -- exactly "active risks nobody assessed this quarter". rpn is the
    -- column the register feeds riskBand(), so the overview bands the
    -- identical number. Empty array, never null.
    (select coalesce(array_agg(ra.rpn::int order by ra.rpn desc), '{}'::int[])
       from risk_assessments ra
       join risks r on r.id = ra.risk_id
      where r.department_id = d.id
        and r.status <> 'retired'
        and ra.reporting_period_id = rp.id
        and ra.type = 'residual')                            as risk_scores

  from departments d
  cross join reporting_periods rp
  where rp.type = 'quarterly'
    and rp.year = p_year
    -- Soft-deleted departments are not part of the company any more.
    and d.status <> 'inactive'
    and (is_ims() or d.id in (select my_department_ids()))
  order by d.name, rp.start_date;
$$;
