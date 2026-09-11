-- 1. One measurement per KPI per period (enables upsert)
alter table public.kpi_measurements
  add constraint kpi_measurements_kpi_period_key
  unique (kpi_id, reporting_period_id);

alter table public.objective_measurements
  add constraint objective_measurements_objective_period_key
  unique (objective_id, reporting_period_id);

-- 2. Snapshot the target at entry time
create or replace function public.snapshot_measurement_target()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.target_value is null
     and new.target_unit is null
     and new.target_direction is null then
    select k.target_value, k.target_unit, k.target_direction
      into new.target_value, new.target_unit, new.target_direction
    from kpis k where k.id = new.kpi_id;
  end if;

  if new.actual_unit is null then
    new.actual_unit := new.target_unit;
  end if;

  return new;
end;
$$;

create trigger kpi_measurements_snapshot_target
  before insert on public.kpi_measurements
  for each row execute function public.snapshot_measurement_target();

-- 3. Closed periods are read-only, except for IMS admins.
--    Also narrows is_ims() to is_ims_admin() so reviewers cannot write.
alter policy kpi_measurements_insert on public.kpi_measurements
  with check (
    exists (
      select 1 from kpis k
      where k.id = kpi_measurements.kpi_id
        and (is_ims_admin() or k.department_id in (select my_department_ids()))
    )
    and exists (
      select 1 from reporting_periods p
      where p.id = kpi_measurements.reporting_period_id
        and (p.status = 'open' or is_ims_admin())
    )
  );

alter policy kpi_measurements_update on public.kpi_measurements
  using (
    exists (
      select 1 from kpis k
      where k.id = kpi_measurements.kpi_id
        and (is_ims_admin() or k.department_id in (select my_department_ids()))
    )
    and exists (
      select 1 from reporting_periods p
      where p.id = kpi_measurements.reporting_period_id
        and (p.status = 'open' or is_ims_admin())
    )
  )
  with check (
    exists (
      select 1 from kpis k
      where k.id = kpi_measurements.kpi_id
        and (is_ims_admin() or k.department_id in (select my_department_ids()))
    )
    and exists (
      select 1 from reporting_periods p
      where p.id = kpi_measurements.reporting_period_id
        and (p.status = 'open' or is_ims_admin())
    )
  );