-- =============================================================
-- Per-user column choice for the KPI and risk tables
-- =============================================================
--
-- One row per user per table: the column keys they chose, in order. No row
-- means the table's Default preset. The keys are the app's column registry
-- keys (src/features/<module>/columns.ts), not database column names, and
-- are not checked here: the app ignores keys it does not know and adds
-- locked ones back, so a registry change never breaks an old save.
--
-- Hard delete, unlike everything else in this schema. A preference is a
-- setting, not a record anyone reports on: "Reset to default" removes the
-- row, and a deleted row reads exactly as one never written.

create table user_table_preferences (
  profile_id uuid        not null references profiles (id) on delete cascade,
  table_key  text        not null check (table_key in ('kpis', 'risks')),
  columns    text[]      not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, table_key)
);

create trigger user_table_preferences_set_updated_at
  before update on user_table_preferences
  for each row execute function set_updated_at();

-- -------------------------------------------------------------
-- RLS: your own rows, and nobody else's — IMS included.
-- -------------------------------------------------------------

alter table user_table_preferences enable row level security;

create policy user_table_preferences_select on user_table_preferences
  for select to authenticated
  using (profile_id = auth.uid());

create policy user_table_preferences_insert on user_table_preferences
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy user_table_preferences_update on user_table_preferences
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy user_table_preferences_delete on user_table_preferences
  for delete to authenticated
  using (profile_id = auth.uid());

revoke all on user_table_preferences from anon, authenticated;
grant select, insert, update, delete on user_table_preferences to authenticated;
