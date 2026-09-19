-- =============================================================
-- v_open_action_items: restore priority and description
-- =============================================================
--
-- The three-way union rewrite in 20260920160000 dropped every actions-only
-- column, including two the UI genuinely needs: priority (the earlier brief
-- asked for status/priority filter chips) and description. Only real
-- actions carry either — treatments and activities are null by nature, not
-- by omission.
--
-- CREATE OR REPLACE VIEW can only append columns at the end without
-- changing the ten already there, so priority and description land after
-- parent_id, not restored to their original position.

create or replace view v_open_action_items
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
  a.source_id as parent_id,
  a.priority,
  a.description
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
  t.risk_id as parent_id,
  null::smallint as priority,
  null::text as description
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
  act.objective_id as parent_id,
  null::smallint as priority,
  null::text as description
from objective_activities act
join objectives o on o.id = act.objective_id
join departments d on d.id = o.department_id
where act.status in ('not_started', 'in_progress');
