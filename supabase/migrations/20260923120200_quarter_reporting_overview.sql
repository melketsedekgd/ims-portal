-- =============================================================
-- quarter_reporting_overview: one row per department, one quarter
-- =============================================================
--
-- What IMS needs on a Tuesday in the last week of a quarter: who has
-- entered their figures, who has submitted, and who is waiting on IMS.
-- That is three questions about one period across every department, and
-- answering it by loading each department's dashboard in turn is how a
-- quarter gets missed.
--
-- The counts are deliberately the same population quarter_missing_items
-- works over, and the "has a value" predicates below are copied from it
-- rather than re-derived. Two definitions of "entered" would eventually
-- disagree, and the one that disagreed would be this one -- the checklist
-- is what blocks a submit, so it is the one that is right by definition.
-- entered = due - missing, exactly.
--
-- Risk has no equivalent: nothing blocks a submit on an unreassessed
-- risk, and the quarterly reports have never treated one as owed. The
-- risk columns are informational, and 'due' there means only "not
-- retired" -- the same population the register itself shows.
--
-- SECURITY INVOKER, so every count is scoped by the reader's own RLS. The
-- department *list* cannot be, though: departments_select is USING(true)
-- so that pickers and org charts work for everyone. Left to RLS alone
-- this function would hand a contributor a row for every department with
-- all its counts zeroed, which reads as "SRD has entered nothing" rather
-- than "this is none of your business". So the row list carries the same
-- predicate the data tables' own policies carry -- is_ims() or one of my
-- departments -- written out here because the table it filters does not
-- carry it. It is not a substitute for RLS; the counts are still scoped
-- by RLS independently, and an empty row would be a permissions result.

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

    -- Objectives: likewise. 'achieved' is excluded along with 'retired',
    -- because a met objective is finished and is not owed a figure.
    (select count(*)::int
       from objectives o
      where o.department_id = d.id
        and o.status = 'active'
        and o.retired_at is null)                               as obj_due,
    (select count(*)::int
       from objectives o
      where o.department_id = d.id
        and o.status = 'active'
        and o.retired_at is null
        and exists (
          select 1
          from objective_measurements om
          where om.objective_id = o.id
            and om.reporting_period_id = p_period_id
            and (om.not_measured or om.achievement is not null)
        ))                                                      as obj_entered,

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

comment on function quarter_reporting_overview(uuid) is
  'One row per participating department for one quarter: how much of its '
  'data is in, where its sign-off has got to, and who signed what. Counts '
  'are scoped by the reader''s RLS; entered = due - quarter_missing_items.';

grant execute on function quarter_reporting_overview(uuid) to authenticated;
