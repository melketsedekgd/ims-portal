-- Staging for Excel import of KPI results. A person uploads a sheet, maps its
-- columns, reviews every staged row, and only then commits (commit_import, next
-- migration). Nothing here touches kpi_measurements; provenance of an imported
-- result lives on import_rows, because kpi_computed_ratio casts a measurement
-- row by position and its columns must not change.

-- ---------------------------------------------------------------------------
-- 1. Saved column mappings, reusable per department
-- ---------------------------------------------------------------------------
create table import_mappings (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id),
  name          text not null check (btrim(name) <> ''),
  -- Normalised header names of the sheet the mapping was made from.
  headers       text[] not null default '{}',
  -- { kpi_name, actual (required), remark, evidence (optional) } → header name.
  column_map    jsonb not null
    check (
      jsonb_typeof(column_map) = 'object'
      and column_map ? 'kpi_name'
      and column_map ? 'actual'
      and column_map - array['kpi_name', 'actual', 'remark', 'evidence'] = '{}'::jsonb
    ),
  created_by    uuid references profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (department_id, name)
);

create trigger import_mappings_set_updated_at
  before update on import_mappings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Batches: one department + one quarter per upload
-- ---------------------------------------------------------------------------
create table import_batches (
  id                  uuid primary key default gen_random_uuid(),
  department_id       uuid not null references departments(id),
  reporting_period_id uuid not null references reporting_periods(id),
  mapping_id          uuid references import_mappings(id) on delete set null,
  file_name           text not null,
  sheet_name          text,
  header_row          int,
  status              import_batch_status not null default 'draft',
  created_by          uuid references profiles(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  committed_at        timestamptz,
  committed_by        uuid references profiles(id),
  check (status <> 'committed' or (committed_at is not null and committed_by is not null))
);

create index import_batches_department_id_idx on import_batches (department_id);
create index import_batches_created_by_idx on import_batches (created_by);

-- ---------------------------------------------------------------------------
-- 3. Staged rows, one per data row of the sheet
-- ---------------------------------------------------------------------------
create table import_rows (
  id                     uuid primary key default gen_random_uuid(),
  batch_id               uuid not null references import_batches(id) on delete cascade,
  row_number             int not null,
  raw                    jsonb not null default '{}'::jsonb,
  kpi_id                 uuid references kpis(id),
  actual_text            text,
  actual_value           numeric,
  actual_unit            text,
  not_measured           boolean not null default false,
  remark                 text,
  evidence_reference     text,
  status                 import_row_status not null default 'check',
  issue                  text,
  replace_existing       boolean not null default false,
  -- Written by commit_import only: what a replaced measurement held before.
  previous_actual_text   text,
  previous_actual_value  numeric,
  previous_actual_unit   text,
  previous_not_measured  boolean,
  measurement_id         uuid references kpi_measurements(id) on delete set null,
  unique (batch_id, row_number)
);

create index import_rows_kpi_id_idx on import_rows (kpi_id);
create index import_rows_measurement_id_idx on import_rows (measurement_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table import_mappings enable row level security;
alter table import_batches  enable row level security;
alter table import_rows     enable row level security;

create policy import_mappings_select on import_mappings
  for select to authenticated
  using (is_ims() or department_id in (select my_department_ids()));
create policy import_mappings_insert on import_mappings
  for insert to authenticated
  with check (
    (department_id in (select my_department_ids()) or is_ims_admin())
    and created_by = auth.uid()
  );
-- WITH CHECK also keeps a mapping inside a department the editor belongs to.
create policy import_mappings_update on import_mappings
  for update to authenticated
  using (
    is_ims_admin()
    or created_by = auth.uid()
    or department_id in (select my_managed_department_ids())
  )
  with check (
    (is_ims_admin()
     or created_by = auth.uid()
     or department_id in (select my_managed_department_ids()))
    and (department_id in (select my_department_ids()) or is_ims_admin())
  );
create policy import_mappings_delete on import_mappings
  for delete to authenticated
  using (
    is_ims_admin()
    or created_by = auth.uid()
    or department_id in (select my_managed_department_ids())
  );

create policy import_batches_select on import_batches
  for select to authenticated
  using (
    created_by = auth.uid()
    or is_ims()
    or department_id in (select my_managed_department_ids())
  );
create policy import_batches_insert on import_batches
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (department_id in (select my_department_ids()) or is_ims_admin())
  );
-- Only a draft can change. The new status is left to the guard trigger below:
-- 'cancelled' is how a creator abandons a batch, 'committed' only commit_import
-- may set. No delete policy: a batch is cancelled, never removed.
create policy import_batches_update on import_batches
  for update to authenticated
  using (created_by = auth.uid() and status = 'draft')
  with check (
    created_by = auth.uid()
    and (department_id in (select my_department_ids()) or is_ims_admin())
  );

-- Visibility follows the parent batch: the subquery is itself filtered by
-- import_batches_select.
create policy import_rows_select on import_rows
  for select to authenticated
  using (exists (select 1 from import_batches b where b.id = import_rows.batch_id));
create policy import_rows_insert on import_rows
  for insert to authenticated
  with check (exists (
    select 1 from import_batches b
    where b.id = import_rows.batch_id
      and b.created_by = auth.uid()
      and b.status = 'draft'));
create policy import_rows_update on import_rows
  for update to authenticated
  using (exists (
    select 1 from import_batches b
    where b.id = import_rows.batch_id
      and b.created_by = auth.uid()
      and b.status = 'draft'))
  with check (exists (
    select 1 from import_batches b
    where b.id = import_rows.batch_id
      and b.created_by = auth.uid()
      and b.status = 'draft'));
create policy import_rows_delete on import_rows
  for delete to authenticated
  using (exists (
    select 1 from import_batches b
    where b.id = import_rows.batch_id
      and b.created_by = auth.uid()
      and b.status = 'draft'));

grant select, insert, update, delete on import_mappings to authenticated;
grant select, insert, update         on import_batches  to authenticated;
grant select, insert, update, delete on import_rows     to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Guards: outcome columns belong to commit_import
-- ---------------------------------------------------------------------------
-- commit_import sets ims.import_commit = 'on' for its own transaction. Anyone
-- else — the UI, a direct API call — may stage and edit rows but may not mark
-- them imported/skipped, link a measurement, or fake a previous value.
create or replace function public.guard_import_row()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_setting('ims.import_commit', true) = 'on' then
    return new;
  end if;

  if new.status in ('imported', 'skipped') then
    raise exception 'Only commit_import may mark a row %', new.status
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.measurement_id is not null
       or new.previous_actual_text is not null
       or new.previous_actual_value is not null
       or new.previous_actual_unit is not null
       or new.previous_not_measured is not null then
      raise exception 'Only commit_import may set measurement_id or previous_* on a row'
        using errcode = '42501';
    end if;
  elsif (new.measurement_id, new.previous_actual_text, new.previous_actual_value,
         new.previous_actual_unit, new.previous_not_measured)
        is distinct from
        (old.measurement_id, old.previous_actual_text, old.previous_actual_value,
         old.previous_actual_unit, old.previous_not_measured) then
    raise exception 'Only commit_import may set measurement_id or previous_* on a row'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger import_rows_guard
  before insert or update on import_rows
  for each row execute function guard_import_row();

create or replace function public.guard_import_batch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_setting('ims.import_commit', true) = 'on' then
    return new;
  end if;

  if new.status = 'committed' then
    raise exception 'Only commit_import may commit a batch'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.committed_at is not null or new.committed_by is not null then
      raise exception 'Only commit_import may set committed_at or committed_by'
        using errcode = '42501';
    end if;
  elsif (new.committed_at, new.committed_by)
        is distinct from (old.committed_at, old.committed_by) then
    raise exception 'Only commit_import may set committed_at or committed_by'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger import_batches_guard
  before insert or update on import_batches
  for each row execute function guard_import_batch();
