-- =============================================================
-- IMS objectives
-- =============================================================

create type objective_status as enum ('active', 'achieved', 'retired');

-- A departmental IMS objective. Long-lived — the reports show
-- objectives spanning the full year, reported on each quarter.
create table objectives (
  id                   uuid primary key default gen_random_uuid(),
  department_id        uuid not null references departments(id),
  reference_number     smallint,
  title                text not null,
  description          text,
  owner_title          text,
  start_date           date,
  target_date          date,
  status               objective_status not null default 'active',
  retired_at           date,
  created_by           uuid references profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint valid_dates check (target_date is null or start_date is null or target_date >= start_date)
);

create trigger objectives_set_updated_at
  before update on objectives
  for each row execute function set_updated_at();


  -- =============================================================
-- Objective activities
-- =============================================================

create type activity_status as enum ('not_started', 'in_progress', 'completed', 'cancelled');

-- The discrete pieces of work an objective decomposes into.
-- Percentage achievement is completed / total, which is where the
-- reports' 33.33% and 66.67% come from — IT's Objective 3 is three
-- activities across 2026, with only Windows monitoring done in Q1.
create table objective_activities (
  id                      uuid primary key default gen_random_uuid(),
  objective_id            uuid not null references objectives(id) on delete restrict,
  title                   text not null,
  description             text,
  owner_title             text,
  planned_start_date      date,
  planned_completion_date date,
  completed_date          date,
  status                  activity_status not null default 'not_started',
  display_order           smallint,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger objective_activities_set_updated_at
  before update on objective_activities
  for each row execute function set_updated_at();

create index objective_activities_objective_idx
  on objective_activities (objective_id, display_order);

  -- Completed / total, excluding cancelled activities. Returns null
-- when an objective has no activities defined, so the UI can show
-- "not decomposed yet" rather than a misleading 0%.
create or replace function objective_achievement(objective uuid)
returns numeric
language sql
stable
as $$
  select case
    when count(*) filter (where status <> 'cancelled') = 0 then null
    else round(
      count(*) filter (where status = 'completed')::numeric
      / count(*) filter (where status <> 'cancelled'),
      4
    )
  end
  from objective_activities
  where objective_id = objective;
$$;

-- =============================================================
-- Objective measurements
-- =============================================================

-- One row per objective per reporting period. Achievement is
-- snapshotted at period close rather than recomputed later, so a
-- Q1 result stays what it was even as activities complete in Q2.
create table objective_measurements (
  id                     uuid primary key default gen_random_uuid(),
  objective_id           uuid not null references objectives(id) on delete restrict,
  reporting_period_id    uuid not null references reporting_periods(id),

  achievement            numeric,
  activities_completed   smallint,
  activities_total       smallint,

  not_measured           boolean not null default false,
  evidence_reference     text,
  reason_for_deviation   text,
  followup_action        text,

  recorded_by            uuid references profiles(id),
  recorded_at            timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint valid_achievement check (achievement is null or achievement between 0 and 1)
);

create unique index objective_measurements_period_idx
  on objective_measurements (objective_id, reporting_period_id);

create trigger objective_measurements_set_updated_at
  before update on objective_measurements
  for each row execute function set_updated_at();

  -- =============================================================
-- RLS: objectives
-- =============================================================

alter table objectives             enable row level security;
alter table objective_activities   enable row level security;
alter table objective_measurements enable row level security;


-- IMS sees every department's objectives; everyone else sees their own.
create policy objectives_select
  on objectives for select
  to authenticated
  using (
    is_ims()
    or department_id in (select my_department_ids())
  );

create policy objectives_insert
  on objectives for insert
  to authenticated
  with check (
    is_ims()
    or department_id in (select my_department_ids())
  );

create policy objectives_update
  on objectives for update
  to authenticated
  using (
    is_ims()
    or department_id in (select my_department_ids())
  )
  with check (
    is_ims()
    or department_id in (select my_department_ids())
  );

-- No delete policy: retire via status.

-- Activities inherit their objective's department scope.
create policy objective_activities_select
  on objective_activities for select
  to authenticated
  using (
    exists (
      select 1 from objectives o
      where o.id = objective_activities.objective_id
        and (is_ims() or o.department_id in (select my_department_ids()))
    )
  );

create policy objective_activities_insert
  on objective_activities for insert
  to authenticated
  with check (
    exists (
      select 1 from objectives o
      where o.id = objective_activities.objective_id
        and (is_ims() or o.department_id in (select my_department_ids()))
    )
  );

create policy objective_activities_update
  on objective_activities for update
  to authenticated
  using (
    exists (
      select 1 from objectives o
      where o.id = objective_activities.objective_id
        and (is_ims() or o.department_id in (select my_department_ids()))
    )
  )
  with check (
    exists (
      select 1 from objectives o
      where o.id = objective_activities.objective_id
        and (is_ims() or o.department_id in (select my_department_ids()))
    )
  );


-- Measurements, same pattern.
create policy objective_measurements_select
  on objective_measurements for select
  to authenticated
  using (
    exists (
      select 1 from objectives o
      where o.id = objective_measurements.objective_id
        and (is_ims() or o.department_id in (select my_department_ids()))
    )
  );

create policy objective_measurements_insert
  on objective_measurements for insert
  to authenticated
  with check (
    exists (
      select 1 from objectives o
      where o.id = objective_measurements.objective_id
        and (is_ims() or o.department_id in (select my_department_ids()))
    )
  );

create policy objective_measurements_update
  on objective_measurements for update
  to authenticated
  using (
    exists (
      select 1 from objectives o
      where o.id = objective_measurements.objective_id
        and (is_ims() or o.department_id in (select my_department_ids()))
    )
  )
  with check (
    exists (
      select 1 from objectives o
      where o.id = objective_measurements.objective_id
        and (is_ims() or o.department_id in (select my_department_ids()))
    )
  );