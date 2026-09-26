-- Per-department quarter sign-off settings, set by the IMS Manager: who may
-- submit the quarter, and whether the department manager approves it before
-- IMS receives it. IMS receive is always required.

-- ---------------------------------------------------------------------------
-- 1. Settings, one row per department. No row = the defaults; none seeded.
-- ---------------------------------------------------------------------------
create table signoff_settings (
  department_id    uuid primary key references departments(id),
  submit_role      text not null default 'contributor_or_manager'
    check (submit_role in ('contributor_or_manager', 'manager_only')),
  manager_approval boolean not null default true,
  updated_by       uuid references profiles(id) default auth.uid(),
  updated_at       timestamptz not null default now()
);

create trigger signoff_settings_set_updated_at
  before update on signoff_settings
  for each row execute function set_updated_at();

-- The column default only covers the insert; an edit must name its editor too.
create or replace function public.stamp_signoff_settings_updated_by()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger signoff_settings_stamp_updated_by
  before update on signoff_settings
  for each row execute function stamp_signoff_settings_updated_by();

alter table signoff_settings enable row level security;

create policy signoff_settings_select on signoff_settings
  for select to authenticated using (true);
create policy signoff_settings_insert on signoff_settings
  for insert to authenticated with check (is_ims_admin());
create policy signoff_settings_update on signoff_settings
  for update to authenticated using (is_ims_admin()) with check (is_ims_admin());
create policy signoff_settings_delete on signoff_settings
  for delete to authenticated using (is_ims_admin());

grant select, insert, update, delete on signoff_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Each quarter snapshots manager_approval at its first submit
-- ---------------------------------------------------------------------------
-- Changing the setting mid-quarter must not re-route a quarter already in
-- flight, so record_quarter_decision stamps it once and keeps it across
-- returns and resubmits. Every existing quarter went through manager
-- approval. Added with a default so existing rows are filled without an
-- UPDATE (which would bump updated_at on all of them), then the default is
-- dropped: a new row gets its value from record_quarter_decision.
alter table quarter_signoffs add column manager_approval boolean default true;
alter table quarter_signoffs alter column manager_approval drop default;
