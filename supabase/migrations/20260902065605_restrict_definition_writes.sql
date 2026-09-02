-- =============================================================
-- Restrict definition writes to managers; lock override columns
-- =============================================================
--
-- Found by impersonating a responsible_user in a rolled-back
-- transaction. Reads were correct: IT saw 44 KPIs, SRD saw 5, and they
-- summed to the admin's 49. Writes were not.
--
-- A responsible_user could set kpis.target_value to 0.01 on their own
-- department's KPI, and could write kpi_measurements.achievement_override
-- with a self-supplied reason. Together: set the bar to nothing, then
-- score yourself 1.0. The same hole existed on objectives (4 rows
-- writable) and risks (11 rows writable).
--
-- Root cause is my_department_ids(). It returns a department for ANY
-- scoped role, so a responsible_user and a department_manager are
-- indistinguishable to every policy that calls it. Nothing is wrong with
-- the function; it is being asked a question it was never meant to
-- answer.
--
-- Measurements stay writable by responsible users. Recording an actual
-- is their job. Only the definitions and the override move up.


-- -------------------------------------------------------------
-- 1. Helpers
-- -------------------------------------------------------------

-- Departments where the caller is specifically the manager.
create or replace function my_managed_department_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ur.department_id
  from user_roles ur
  join roles r on r.id = ur.role_id
  where ur.profile_id = auth.uid()
    and ur.department_id is not null
    and r.key = 'department_manager';
$$;

comment on function my_managed_department_ids() is
  'Departments the caller manages. Use for write policies; my_department_ids() is for reads.';

-- is_ims() includes ims_reviewer, which is a read role. A reviewer
-- should not be able to rewrite a target. Narrower predicate for writes.
create or replace function is_ims_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role(array['system_admin', 'ims_admin']);
$$;

comment on function is_ims_admin() is
  'System and IMS admins only. Excludes ims_reviewer, which is read-only.';


-- -------------------------------------------------------------
-- 2. Definition tables: manager or IMS admin only
-- -------------------------------------------------------------
-- SELECT policies are deliberately untouched. They verified correct.

drop policy if exists kpis_insert on kpis;
drop policy if exists kpis_update on kpis;

create policy kpis_insert on kpis for insert to authenticated
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );

create policy kpis_update on kpis for update to authenticated
  using (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  )
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );


drop policy if exists objectives_insert on objectives;
drop policy if exists objectives_update on objectives;

create policy objectives_insert on objectives for insert to authenticated
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );

create policy objectives_update on objectives for update to authenticated
  using (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  )
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );


drop policy if exists risks_insert on risks;
drop policy if exists risks_update on risks;

create policy risks_insert on risks for insert to authenticated
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );

create policy risks_update on risks for update to authenticated
  using (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  )
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );


-- -------------------------------------------------------------
-- 3. Override columns on kpi_measurements
-- -------------------------------------------------------------
-- RLS is row-level, and the same user legitimately writes actual_value
-- on the same row they must not write achievement_override on. So the
-- split has to be a trigger comparing OLD to NEW.
--
-- Also stamps overridden_by/overridden_at rather than trusting the
-- client to set them honestly.

create or replace function guard_measurement_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kpi_department_id uuid;
  override_changed boolean;
begin
  override_changed :=
       new.achievement_override is distinct from old.achievement_override
    or new.override_reason      is distinct from old.override_reason;

  if not override_changed then
    -- Nobody may hand-edit the audit stamps on an untouched override.
    new.overridden_by := old.overridden_by;
    new.overridden_at := old.overridden_at;
    return new;
  end if;

  select k.department_id into kpi_department_id
  from kpis k where k.id = new.kpi_id;

  if not (
    is_ims_admin()
    or kpi_department_id in (select my_managed_department_ids())
  ) then
    raise exception
      'Only the department manager or an IMS admin may set achievement_override'
      using errcode = '42501';
  end if;

  if new.achievement_override is not null
     and coalesce(btrim(new.override_reason), '') = '' then
    raise exception 'override_reason is required when setting achievement_override'
      using errcode = '23514';
  end if;

  new.overridden_by := auth.uid();
  new.overridden_at := now();
  return new;
end;
$$;

create trigger kpi_measurements_guard_override
  before update on kpi_measurements
  for each row execute function guard_measurement_override();

-- On insert the override must be absent. It is a review action taken
-- after a value exists, never part of first entry.
create or replace function guard_measurement_override_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.achievement_override is not null then
    if not (
      is_ims_admin()
      or (select k.department_id from kpis k where k.id = new.kpi_id)
         in (select my_managed_department_ids())
    ) then
      raise exception
        'Only the department manager or an IMS admin may set achievement_override'
        using errcode = '42501';
    end if;
    new.overridden_by := auth.uid();
    new.overridden_at := now();
  else
    new.overridden_by := null;
    new.overridden_at := null;
  end if;
  return new;
end;
$$;

create trigger kpi_measurements_guard_override_insert
  before insert on kpi_measurements
  for each row execute function guard_measurement_override_insert();