-- =============================================================
-- Backfill follow-up commitments into actions
-- =============================================================
--
-- Two free-text columns record a follow-up nobody can currently list:
--   objective_measurements.followup_action   (12 populated)
--   risk_treatment_reviews.followup_measure   (7 populated)
--
-- Source columns are read-only here — nothing is dropped, renamed or
-- nulled, same two-sources-of-truth decision as the evidence backfill.
-- Null, empty and whitespace-only values are skipped.
--
-- due_date is null: the source has none, and inventing one would be a
-- fabricated fact on an audit-relevant record. status is 'open' for
-- every row — some of these are Q1/Q2 follow-ups that have probably
-- already been done, but nothing in the source data says which, and
-- guessing completion is worse than importing them open and letting
-- IMS close the finished ones on review.
--
-- title is the text truncated to 120 characters (117 + an ellipsis);
-- description carries the text in full.

insert into actions (department_id, source_type, source_id, title, description, owner_title, due_date, status, created_by)
select
  o.department_id,
  'objective_measurement'::action_source,
  m.id,
  case
    when length(btrim(m.followup_action)) > 120
      then left(btrim(m.followup_action), 117) || '...'
    else btrim(m.followup_action)
  end,
  btrim(m.followup_action),
  o.owner_title,
  null,
  'open',
  null
from objective_measurements m
join objectives o on o.id = m.objective_id
where btrim(coalesce(m.followup_action, '')) <> '';

insert into actions (department_id, source_type, source_id, title, description, owner_title, due_date, status, created_by)
select
  r.department_id,
  'risk_treatment_review'::action_source,
  v.id,
  case
    when length(btrim(v.followup_measure)) > 120
      then left(btrim(v.followup_measure), 117) || '...'
    else btrim(v.followup_measure)
  end,
  btrim(v.followup_measure),
  t.owner_title,
  null,
  'open',
  null
from risk_treatment_reviews v
join risk_treatments t on t.id = v.treatment_id
join risks r on r.id = t.risk_id
where btrim(coalesce(v.followup_measure, '')) <> '';


-- =============================================================
-- v_open_action_items — replaced: union all three sources of open work
-- =============================================================
--
-- As built this selected from actions alone, so on live data (0 rows
-- until this migration, and even after, most open work isn't an
-- `actions` row at all) it returned nothing and the dashboard card
-- stayed empty. Open work lives in three tables; the view now unions
-- them into one shape instead of only ever showing one source.
--
-- Treatments and activities are read here, not copied into actions:
-- a treatment has its own review cycle and activities are the
-- denominator of objective achievement. Duplicating either into
-- actions would create a second source of truth for both.
--
-- The column list changes shape entirely from the previous version
-- (kind/parent_type/parent_id replace source_type/source_id, several
-- actions-only columns are dropped), which CREATE OR REPLACE VIEW
-- cannot do — Postgres only allows appending columns in place. Drop
-- and recreate instead.
--
-- security_invoker = true is load-bearing on a three-table union: without
-- it the view runs as owner and bypasses RLS on actions, risk_treatments
-- and objective_activities all at once.

drop view v_open_action_items;

create view v_open_action_items
  with (security_invoker = true)
as
select
  'action'::text as kind,
  a.id,
  a.department_id,
  d.name as department_name,
  a.title,
  a.owner_title,
  a.due_date,
  a.status::text as status,
  a.source_type::text as parent_type,
  a.source_id as parent_id
from actions a
join departments d on d.id = a.department_id
where a.status not in ('completed', 'cancelled')

union all

select
  'risk_treatment'::text as kind,
  t.id,
  r.department_id,
  d.name as department_name,
  t.treatment_solution as title,
  t.owner_title,
  t.target_date as due_date,
  t.status::text as status,
  'risk'::text as parent_type,
  t.risk_id as parent_id
from risk_treatments t
join risks r on r.id = t.risk_id
join departments d on d.id = r.department_id
where t.status in ('planned', 'in_progress')

union all

select
  'objective_activity'::text as kind,
  act.id,
  o.department_id,
  d.name as department_name,
  act.title,
  act.owner_title,
  act.planned_completion_date as due_date,
  act.status::text as status,
  'objective'::text as parent_type,
  act.objective_id as parent_id
from objective_activities act
join objectives o on o.id = act.objective_id
join departments d on d.id = o.department_id
where act.status in ('not_started', 'in_progress');
