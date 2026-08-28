-- =============================================================
-- Units of measurement
-- =============================================================

-- Units are data, not code — IMS adds 'kg' with an insert, not a
-- migration. `dimension` is what makes comparison safe: two values
-- are only comparable if they share one. `factor_to_base` converts
-- within a dimension (base units: second, ratio, item).
create table units (
  key             text primary key,
  label           text not null,
  dimension       text not null,
  factor_to_base  numeric not null,
  created_at      timestamptz not null default now()
);

insert into units (key, label, dimension, factor_to_base) values
  ('ms',       'milliseconds',  'time',   0.001),
  ('s',        'seconds',       'time',   1),
  ('min',      'minutes',       'time',   60),
  ('hr',       'hours',         'time',   3600),
  ('day',      'days',          'time',   86400),
  ('week',     'weeks',         'time',   604800),
  ('month',    'months',        'time',   2629800),
  ('ratio',    'ratio (0-1)',   'ratio',  1),
  ('percent',  'percent',       'ratio',  0.01),
  ('count',    'count',         'count',  1),
  ('story_pt', 'story points',  'count',  1);

alter table units enable row level security;

create policy units_select
  on units for select
  to authenticated
  using (true);

create policy units_write
  on units for all
  to authenticated
  using (has_role(array['system_admin', 'ims_admin']))
  with check (has_role(array['system_admin', 'ims_admin']));



-- =============================================================
-- KPI definitions
-- =============================================================

create type kpi_status         as enum ('active', 'retired');
create type target_direction   as enum ('higher_is_better', 'lower_is_better', 'exact');
create type aggregation_method as enum ('average', 'sum', 'min', 'max', 'latest');

-- What is being measured. Set at the start of the year and rarely
-- changed. Periodic results live in kpi_measurements.
create table kpis (
  id                    uuid primary key default gen_random_uuid(),
  department_id         uuid not null references departments(id),
  process_id            uuid references processes(id),
  parent_kpi_id         uuid references kpis(id),
  name                  text not null,
  description           text,

  target_text           text,
  target_value          numeric,
  target_unit           text references units(key),
  target_direction      target_direction not null,

  measurement_frequency period_type not null,
  reporting_frequency   period_type not null default 'quarterly',
  aggregation_method    aggregation_method not null default 'average',

  data_source           text,
  analysis_methodology  text,
  responsibility_title  text,
  display_order         smallint,

  status                kpi_status not null default 'active',
  retired_at            date,
  created_by            uuid references profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint no_self_parent check (id is distinct from parent_kpi_id)
);

create trigger kpis_set_updated_at
  before update on kpis
  for each row execute function set_updated_at();

create index kpis_department_idx on kpis (department_id, status);


-- =============================================================
-- KPI measurements
-- =============================================================

-- One row per KPI per reporting period. The target is copied in at
-- entry time rather than read from the definition, so a target
-- change in 2027 cannot silently re-score 2026 results.
create table kpi_measurements (
  id                    uuid primary key default gen_random_uuid(),
  kpi_id                uuid not null references kpis(id) on delete restrict,
  reporting_period_id   uuid not null references reporting_periods(id),

  actual_text           text,
  actual_value          numeric,
  actual_unit           text references units(key),

  target_value          numeric,
  target_unit           text references units(key),
  target_direction      target_direction,

  not_measured          boolean not null default false,
  remark                text,
  evidence_reference    text,
  recorded_by           uuid references profiles(id),
  recorded_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint measured_or_not check (
    not_measured or actual_text is not null or actual_value is not null
  )
);

create unique index kpi_measurements_period_idx
  on kpi_measurements (kpi_id, reporting_period_id);

create trigger kpi_measurements_set_updated_at
  before update on kpi_measurements
  for each row execute function set_updated_at();



-- Achievement ratio, matching the reports' "Q_ Vs AT" column:
--   higher_is_better  -> min(actual / target, 1)
--   lower_is_better   -> min(target / actual, 1)
-- Both values are converted to their dimension's base unit first,
-- so percent-vs-ratio and weeks-vs-days compare correctly.
create or replace function kpi_achievement_ratio(m kpi_measurements)
returns numeric
language sql
stable
as $$
  with converted as (
    select
      m.actual_value * au.factor_to_base as actual_base,
      m.target_value * tu.factor_to_base as target_base,
      au.dimension as actual_dim,
      tu.dimension as target_dim
    from units au, units tu
    where au.key = m.actual_unit
      and tu.key = m.target_unit
  )
  select case
    when m.not_measured then null
    when actual_base is null or target_base is null then null
    when actual_dim is distinct from target_dim then null
    when m.target_direction = 'higher_is_better' and target_base > 0
      then least(actual_base / target_base, 1)
    when m.target_direction = 'lower_is_better' and actual_base > 0
      then least(target_base / actual_base, 1)
    when m.target_direction = 'exact'
      then case when actual_base = target_base then 1 else 0 end
  end
  from converted;
$$;



-- =============================================================
-- RLS: kpis
-- =============================================================

alter table kpis             enable row level security;
alter table kpi_measurements enable row level security;


-- IMS sees every department's KPIs; everyone else sees their own.
create policy kpis_select
  on kpis for select
  to authenticated
  using (
    is_ims()
    or department_id in (select my_department_ids())
  );

create policy kpis_insert
  on kpis for insert
  to authenticated
  with check (
    is_ims()
    or department_id in (select my_department_ids())
  );

create policy kpis_update
  on kpis for update
  to authenticated
  using (
    is_ims()
    or department_id in (select my_department_ids())
  )
  with check (
    is_ims()
    or department_id in (select my_department_ids())
  );

-- No delete policy: retire via status, keeping historical
-- measurements attributable (DATA-01).


-- Measurements inherit their KPI's department scope.
create policy kpi_measurements_select
  on kpi_measurements for select
  to authenticated
  using (
    exists (
      select 1 from kpis k
      where k.id = kpi_measurements.kpi_id
        and (is_ims() or k.department_id in (select my_department_ids()))
    )
  );

create policy kpi_measurements_insert
  on kpi_measurements for insert
  to authenticated
  with check (
    exists (
      select 1 from kpis k
      where k.id = kpi_measurements.kpi_id
        and (is_ims() or k.department_id in (select my_department_ids()))
    )
  );

create policy kpi_measurements_update
  on kpi_measurements for update
  to authenticated
  using (
    exists (
      select 1 from kpis k
      where k.id = kpi_measurements.kpi_id
        and (is_ims() or k.department_id in (select my_department_ids()))
    )
  )
  with check (
    exists (
      select 1 from kpis k
      where k.id = kpi_measurements.kpi_id
        and (is_ims() or k.department_id in (select my_department_ids()))
    )
  );




