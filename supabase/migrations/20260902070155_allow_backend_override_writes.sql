-- =============================================================
-- Let backend contexts write achievement_override
-- =============================================================
--
-- The guards added in restrict_definition_writes fire for every caller,
-- including service_role. Triggers are not bypassed by BYPASSRLS. Under
-- service_role auth.uid() is null, so is_ims_admin() is false and seed
-- scripts are refused.
--
-- Caught before it bit: kpi_measurements currently holds 0 overrides, so
-- nothing existing is affected. But the Q1 SRD sprint velocity row (6.5
-- against a 10-point target, scored 1.0) is an override, and seeding it
-- once IMS confirms the scoring would have failed.
--
-- Exempting service_role gives away nothing. Anyone holding that key
-- already bypasses every RLS policy in the schema. The guard exists to
-- constrain authenticated users, and it still does.
--
-- Backend writes keep whatever overridden_by they supply, including
-- null. A row loaded from a paper report has no in-app approver, and
-- recording null is more honest than inventing one.

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
    new.overridden_by := old.overridden_by;
    new.overridden_at := old.overridden_at;
    return new;
  end if;

  -- Data-quality rule, applies to everyone including the backend.
  if new.achievement_override is not null
     and coalesce(btrim(new.override_reason), '') = '' then
    raise exception 'override_reason is required when setting achievement_override'
      using errcode = '23514';
  end if;

  -- No authenticated user means service_role, a migration, or a seed
  -- script. Trust it and leave the stamps as supplied.
  if auth.uid() is null then
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

  new.overridden_by := auth.uid();
  new.overridden_at := now();
  return new;
end;
$$;


create or replace function guard_measurement_override_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.achievement_override is null then
    new.overridden_by := null;
    new.overridden_at := null;
    return new;
  end if;

  if coalesce(btrim(new.override_reason), '') = '' then
    raise exception 'override_reason is required when setting achievement_override'
      using errcode = '23514';
  end if;

  if auth.uid() is null then
    return new;
  end if;

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
  return new;
end;
$$;