-- =============================================================
-- Column choices for every list table, not only KPIs and risks
-- =============================================================
--
-- user_table_preferences.table_key was checked against ('kpis', 'risks').
-- Every list table now has a column chooser, each saving under its own
-- key; without this the save is rejected and the choice lasts only until
-- the page reloads. The keys match TableKey in src/lib/columns.ts — add
-- to both.
--
-- No data change: existing rows are all 'kpis' or 'risks', which the new
-- check still allows. Not applied by the PR that adds it; run
-- `supabase db push`.

alter table user_table_preferences
  drop constraint user_table_preferences_table_key_check;

alter table user_table_preferences
  add constraint user_table_preferences_table_key_check check (
    table_key in (
      'kpis',
      'risks',
      'objectives',
      'actions',
      'documents',
      'document_requests',
      'admin_users',
      'admin_departments',
      'shared_kpis',
      'shared_risks'
    )
  );
