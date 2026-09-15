-- Objective measurements become writable from the app, with the activity
-- split KPIs already have: definitions are a manager's, results are a
-- Responsible User's.

-- =============================================================
-- 1. objective_activities policies
-- =============================================================
--
-- Both write policies used is_ims() OR my_department_ids(). is_ims()
-- includes ims_reviewer, who must not write, and any responsible user
-- could add an activity — which changes the denominator every later
-- measurement is scored against.
--
--   INSERT  a definition change  → is_ims_admin() OR my_managed_department_ids()
--   UPDATE  marking progress     → is_ims_admin() OR my_department_ids()
--
-- There is no DELETE policy, deliberately, and cancelling (below) is
-- arithmetically the same as deleting.

alter policy objective_activities_insert on public.objective_activities
  with check (
    exists (
      select 1 from objectives o
      where o.id = objective_activities.objective_id
        and (is_ims_admin() or o.department_id in (select my_managed_department_ids()))
    )
  );

alter policy objective_activities_update on public.objective_activities
  using (
    exists (
      select 1 from objectives o
      where o.id = objective_activities.objective_id
        and (is_ims_admin() or o.department_id in (select my_department_ids()))
    )
  )
  with check (
    exists (
      select 1 from objectives o
      where o.id = objective_activities.objective_id
        and (is_ims_admin() or o.department_id in (select my_department_ids()))
    )
  );

-- =============================================================
-- 2. Column-level guard on objective_activities updates
-- =============================================================
--
-- RLS grants UPDATE on the whole row. A Responsible User may move an
-- activity through not_started / in_progress / completed and set its
-- completed_date; everything else on the row is the definition, and a
-- manager's. Cancelling is included on the definition side because
-- objective_achievement() drops cancelled rows from the denominator —
-- cancelling raises the score exactly as deleting would.
--
-- Modelled on guard_measurement_override(): passes through when
-- auth.uid() is null so migrations and seed scripts are unaffected.

create or replace function public.guard_activity_definition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  definition_changed boolean;
begin
  -- No authenticated user means a migration, a seed script, or
  -- service_role. Trust it.
  if auth.uid() is null then
    return new;
  end if;

  if is_ims_admin()
     or (select o.department_id from objectives o where o.id = new.objective_id)
        in (select my_managed_department_ids()) then
    return new;
  end if;

  definition_changed :=
       new.objective_id            is distinct from old.objective_id
    or new.title                   is distinct from old.title
    or new.description             is distinct from old.description
    or new.owner_title             is distinct from old.owner_title
    or new.planned_start_date      is distinct from old.planned_start_date
    or new.planned_completion_date is distinct from old.planned_completion_date
    or new.display_order           is distinct from old.display_order;

  if definition_changed then
    raise exception
      'Only a department manager or an IMS admin may change an activity''s definition'
      using errcode = '42501';
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    raise exception
      'Only a department manager or an IMS admin may cancel an activity'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger objective_activities_guard_definition
  before update on public.objective_activities
  for each row execute function public.guard_activity_definition();

-- =============================================================
-- 3. Snapshot activity counts onto objective_measurements
-- =============================================================
--
-- achievement, activities_completed and activities_total were set by hand
-- in the seeds. Nothing computed them, so a row written by the app would
-- store nulls.
--
--   has activities  → overwrite all three from the live counts. Always, not
--                     only when null: the count is the authority and a
--                     client must not be able to send a different number.
--   no activities   → keep the client's achievement (SRD's objectives have
--                     no decomposition; their figure is entered from the
--                     report), leave both counts null.
--   not_measured    → achievement and both counts null.
--
-- "Has activities" means at least one non-cancelled activity, the same
-- test objective_achievement() uses for returning null, and the ratio
-- comes from that function so "achieved" is defined once.
--
-- BEFORE INSERT OR UPDATE, unlike the KPI target snapshot, which is
-- INSERT-only. A KPI target must never re-score history; an objective
-- measurement is explicitly a snapshot of the activity counts at save
-- time, and re-saving inside an open period should re-take it. Closed
-- periods are already refused by the write policies.

create or replace function public.snapshot_objective_measurement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total     integer;
  v_completed integer;
begin
  if new.not_measured then
    new.achievement          := null;
    new.activities_completed := null;
    new.activities_total     := null;
    return new;
  end if;

  select count(*) filter (where status <> 'cancelled'),
         count(*) filter (where status = 'completed')
    into v_total, v_completed
  from objective_activities
  where objective_id = new.objective_id;

  if v_total > 0 then
    new.activities_total     := v_total;
    new.activities_completed := v_completed;
    new.achievement          := objective_achievement(new.objective_id);
  else
    new.activities_total     := null;
    new.activities_completed := null;
    -- new.achievement stays as supplied
  end if;

  return new;
end;
$$;

create trigger objective_measurements_snapshot
  before insert or update on public.objective_measurements
  for each row execute function public.snapshot_objective_measurement();
