-- =============================================================
-- department_performance: how much of the quarter is actually in
-- =============================================================
--
-- The overview was colouring partial quarters. IT in Q3 had one objective
-- measured out of four and the cell went green at 100%, which is true of
-- the one row entered and says nothing about the department — the number
-- was right and the colour was a lie. A quarter still being typed cannot
-- be judged, so the overview needs to know how much of it has arrived,
-- which means the same due/entered counts quarter_reporting_overview
-- already carries.
--
-- The predicates below are copied from that function, which copied them
-- from quarter_missing_items. All three must agree: the checklist decides
-- what a department owes, so anything else deciding it differently would
-- let the overview call a quarter complete that the checklist still
-- blocks from being submitted.
--
-- DROP then CREATE, because the return type gains four columns and
-- postgres will not replace a set-returning function's signature in
-- place. The grant goes with it and has to be reissued.

drop function if exists department_performance(int);

create function department_performance(p_year int)
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

    -- 'achieved' is excluded along with 'retired', because a met objective
    -- is finished and is not owed a figure.
    (select count(*)::int
       from objectives o
      where o.department_id = d.id
        and o.status = 'active'
        and o.retired_at is null)                            as obj_due,
    (select count(*)::int
       from objectives o
      where o.department_id = d.id
        and o.status = 'active'
        and o.retired_at is null
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

comment on function department_performance(int) is
  'One row per department per quarter of p_year: how many KPIs were measured '
  'and how many hit target, how much of the quarter has been entered at all, '
  'objective achievement, and the residual risk scores to be banded by '
  'riskBand() in the app. Scoped by the reader''s RLS.';

grant execute on function department_performance(int) to authenticated;
