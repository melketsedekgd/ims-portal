-- =============================================================
-- department_performance: one row per department per quarter
-- =============================================================
--
-- The company overview asks a different question from
-- quarter_reporting_overview. That one asks whether a department's quarter
-- is *in* — how much is entered, who has signed. This one asks how the
-- department actually *did*, which is a different set of numbers over a
-- whole year rather than one period, so it is a second function rather
-- than more columns on the first.
--
-- Counted from measurements, not from today's definitions. A KPI retired
-- since Q1 was still measured in Q1 and belongs in Q1's score; starting
-- from kpis and left-joining would quietly drop it and make old quarters
-- improve every time something is retired.
--
-- Banding is deliberately absent. riskBand() in features/risks/scoring.ts
-- owns the 15/5 thresholds, and its own comment records what a second copy
-- cost last time: the register and the dashboard disagreed about the same
-- risk. So this returns the raw scores as an array and the thresholds stay
-- in the one place that already has them. The same goes for the heatmap's
-- cut-offs, which live in features/dashboard/heatmap.ts.
--
-- SECURITY INVOKER, so every count is scoped by the reader's own RLS. The
-- department list cannot be — departments_select is USING(true) so pickers
-- work for everyone — so the row list carries the same explicit predicate
-- quarter_reporting_overview carries, for the same reason: without it a
-- contributor gets a row per department with every count zeroed, which
-- reads as "SRD measured nothing" rather than "not yours to see".

create or replace function department_performance(p_year int)
returns table (
  department_id        uuid,
  code                 text,
  name                 text,
  period_id            uuid,
  quarter              text,
  kpi_measured         int,
  kpi_on_target        int,
  obj_measured         int,
  obj_achievement_avg  numeric,
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

    -- Measured: an answer was recorded. A recorded "not measured" is an
    -- answer too, but it is not a measurement, so it is excluded from both
    -- the numerator and the denominator rather than counting as a miss.
    -- Same "has a value" predicate quarter_missing_items uses.
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
    -- so >= 1 is "hit the target or better" and cannot be gamed by a wild
    -- actual. An override is stored uncapped, which is why this is >= 1
    -- and not = 1.
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

    (select count(*)::int
       from objective_measurements om
       join objectives o on o.id = om.objective_id
      where o.department_id = d.id
        and om.reporting_period_id = rp.id
        and not om.not_measured
        and om.achievement is not null)                      as obj_measured,

    -- Stored as a 0..1 fraction, and returned as one. Rounded here rather
    -- than in TypeScript so the query and the screen agree.
    (select round(avg(om.achievement), 4)
       from objective_measurements om
       join objectives o on o.id = om.objective_id
      where o.department_id = d.id
        and om.reporting_period_id = rp.id
        and not om.not_measured
        and om.achievement is not null)                      as obj_achievement_avg,

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
    -- identical number. Empty array, never null, so callers need no
    -- coalesce before .length.
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

comment on function department_performance(int) is
  'One row per department per quarter of p_year: how many KPIs were measured '
  'and how many hit target, objective achievement, and the residual risk '
  'scores to be banded by riskBand() in the app. Scoped by the reader''s RLS.';

grant execute on function department_performance(int) to authenticated;
