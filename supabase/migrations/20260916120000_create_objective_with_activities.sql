-- =============================================================
-- create_objective_with_activities(): objective and its activities in one
-- transaction
-- =============================================================
--
-- An objective scores in one of two modes: completed ÷ total when it has
-- activities, a directly entered figure when it has none. Two PostgREST
-- calls could leave the first mode's objective sitting with zero activities
-- if the second insert failed — silently in direct-entry mode, which nobody
-- chose — and there is no delete policy to undo it with. One function
-- cannot: a failure on either insert rolls back both.
--
-- SECURITY INVOKER (the default) on purpose: objectives_insert and
-- objective_activities_insert apply as the caller, and created_by is their
-- auth.uid().
--
-- reference_number is max + 1 within the department. It is a display label
-- that the reports restart per quarter and reuse, not an identifier, so a
-- concurrent collision is cosmetic and gets no lock or constraint.

create or replace function create_objective_with_activities(
  p_department_id  uuid,
  p_title          text,
  p_description    text,
  p_owner_title    text,
  p_start_date     date,
  p_target_date    date,
  p_process_id     uuid,     -- null when the objective sits under no process
  p_activities     jsonb     -- [{title, description, owner_title, planned_start_date, planned_completion_date}], in display order
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  obj_id uuid;
begin
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'An objective needs a title'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_activities, '[]'::jsonb)) as a(value)
    where coalesce(btrim(a.value ->> 'title'), '') = ''
  ) then
    raise exception 'Every activity needs a title'
      using errcode = '23514';
  end if;

  insert into objectives (
    department_id,
    process_id,
    reference_number,
    title,
    description,
    owner_title,
    start_date,
    target_date,
    created_by
  )
  values (
    p_department_id,
    p_process_id,
    (select coalesce(max(reference_number), 0) + 1
       from objectives
      where department_id = p_department_id),
    btrim(p_title),
    nullif(btrim(p_description), ''),
    nullif(btrim(p_owner_title), ''),
    p_start_date,
    p_target_date,
    auth.uid()
  )
  returning id into obj_id;

  -- status is left to its default (not_started). display_order is the
  -- array position, 1-based, so the form's row order is the report's.
  insert into objective_activities (
    objective_id,
    title,
    description,
    owner_title,
    planned_start_date,
    planned_completion_date,
    display_order
  )
  select
    obj_id,
    btrim(a.value ->> 'title'),
    nullif(btrim(a.value ->> 'description'), ''),
    nullif(btrim(a.value ->> 'owner_title'), ''),
    (a.value ->> 'planned_start_date')::date,
    (a.value ->> 'planned_completion_date')::date,
    a.ordinality
  from jsonb_array_elements(coalesce(p_activities, '[]'::jsonb))
    with ordinality as a(value, ordinality);

  return obj_id;
end;
$$;

comment on function create_objective_with_activities(uuid, text, text, text, date, date, uuid, jsonb) is
  'Create an objective and its activities atomically. Security invoker: RLS applies as the caller. reference_number is max + 1 within the department.';
