-- =============================================================
-- Foundation tables for the IMS platform
-- =============================================================

-- Organization settings
-- MMCY is a single company, so this holds org-level settings
-- rather than being a multi-tenant table.
create table organization_settings (
  id                       boolean primary key default true,
  name                     text not null,
  fiscal_year_start_month  smallint not null default 1,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint singleton check (id),
  constraint valid_month  check (fiscal_year_start_month between 1 and 12)
);

-- Department status
create type department_status as enum ('active', 'inactive');

-- Departments
-- Departments are data, not hard-coded app sections. Supports
-- sub-departments via parent_department_id, and preserves history
-- via effective_from / effective_to rather than deleting rows.
create table departments (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  code                  text not null,
  description           text,
  parent_department_id  uuid references departments(id),
  status                department_status not null default 'active',
  effective_from        date not null default current_date,
  effective_to          date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint no_self_parent check (id is distinct from parent_department_id),
  constraint valid_period   check (effective_to is null or effective_to >= effective_from)
);

-- A department code is unique only among currently-active departments,
-- so a code can be reused years later after one is dissolved.
create unique index departments_code_active_idx
  on departments (code)
  where effective_to is null;


-- Profile status
create type profile_status as enum ('active', 'inactive');

-- Profiles
-- Supabase Auth owns auth.users (email, password, sessions).
-- This table holds everything else about a person. One row per
-- auth user, linked by a shared id.
create table profiles (
  id            uuid primary key references auth.users(id) on delete restrict,
  full_name     text not null,
  job_title     text,
  status        profile_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- Roles
-- The role catalogue from the design doc. A table rather than an
-- enum, because roles may gain permission metadata later and
-- adding a row is easier than altering a type.
create table roles (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  name         text not null,
  description  text,
  created_at   timestamptz not null default now()
);

insert into roles (key, name) values
  ('system_admin',       'System Administrator'),
  ('ims_admin',          'IMS Administrator'),
  ('ims_reviewer',       'IMS Reviewer'),
  ('department_manager', 'Department Manager'),
  ('responsible_user',   'Responsible User'),
  ('document_owner',     'Document Owner'),
  ('approver',           'Approver'),
  ('viewer',             'Viewer / Auditor');



  -- User roles
-- Join table: a person can hold a role, scoped to a department.
-- Org-wide roles (IMS, System Admin) have department_id = null.
create table user_roles (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  role_id        uuid not null references roles(id) on delete restrict,
  department_id  uuid references departments(id),
  created_at     timestamptz not null default now()
);

create unique index user_roles_unique_idx
  on user_roles (profile_id, role_id, coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid));



-- Reporting period type and status
create type period_type   as enum ('monthly', 'quarterly', 'semi_annual', 'annual');
create type period_status as enum ('open', 'closed');

-- Reporting periods
-- Every measurement in the system pins to one of these, so results
-- are comparable across time. Periods of different types overlap by
-- design: 2026 Q2 sits inside 2026 Annual.
create table reporting_periods (
  id            uuid primary key default gen_random_uuid(),
  year          smallint not null,
  label         text not null,
  type          period_type not null,
  start_date    date not null,
  end_date      date not null,
  status        period_status not null default 'open',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint valid_range check (end_date >= start_date),
  constraint valid_year  check (year between 2000 and 2100)
);

create unique index reporting_periods_unique_idx
  on reporting_periods (year, type, label);



-- =============================================================
-- updated_at maintenance
-- =============================================================

-- Sets updated_at to now() on every UPDATE. Attached to each table
-- that has the column, so the value can't drift from reality.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organization_settings_set_updated_at
  before update on organization_settings
  for each row execute function set_updated_at();

create trigger departments_set_updated_at
  before update on departments
  for each row execute function set_updated_at();

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger reporting_periods_set_updated_at
  before update on reporting_periods
  for each row execute function set_updated_at();






-- =============================================================
-- Row Level Security
-- =============================================================

alter table organization_settings enable row level security;
alter table departments           enable row level security;
alter table profiles              enable row level security;
alter table roles                 enable row level security;
alter table user_roles            enable row level security;
alter table reporting_periods     enable row level security;


-- Does the current user hold any of the given role keys?
-- Org-wide check, ignores department scoping.
create or replace function has_role(role_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.profile_id = auth.uid()
      and r.key = any(role_keys)
  );
$$;

-- IMS-level roles see the whole organization.
create or replace function is_ims()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role(array['system_admin', 'ims_admin', 'ims_reviewer']);
$$;

-- Which departments is the current user assigned to?
create or replace function my_department_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ur.department_id
  from user_roles ur
  where ur.profile_id = auth.uid()
    and ur.department_id is not null;
$$;




-- =============================================================
-- Policies: departments
-- =============================================================

-- Everyone reads the department list. Names appear throughout the
-- UI — risk owners, document requests, dashboard filters.
create policy departments_select
  on departments for select
  to authenticated
  using (true);

-- Only IMS creates or dissolves departments.
create policy departments_insert
  on departments for insert
  to authenticated
  with check (has_role(array['system_admin', 'ims_admin']));

create policy departments_delete
  on departments for delete
  to authenticated
  using (has_role(array['system_admin']));

-- IMS can update any department. A Department Manager can update
-- their own — but only certain columns; see the trigger below.
create policy departments_update
  on departments for update
  to authenticated
  using (
    has_role(array['system_admin', 'ims_admin'])
    or (
      has_role(array['department_manager'])
      and id in (select my_department_ids())
    )
  )
  with check (
    has_role(array['system_admin', 'ims_admin'])
    or (
      has_role(array['department_manager'])
      and id in (select my_department_ids())
    )
  );




-- Structural columns on departments have history consequences:
-- reparenting changes the org chart, and setting effective_to
-- dissolves the department under every record attached to it.
-- Department Managers can edit their department's descriptive
-- fields, not these.
create or replace function guard_department_structure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if has_role(array['system_admin', 'ims_admin']) then
    return new;
  end if;

  if new.parent_department_id is distinct from old.parent_department_id
     or new.effective_from is distinct from old.effective_from
     or new.effective_to   is distinct from old.effective_to
     or new.status         is distinct from old.status
  then
    raise exception 'Only IMS can change department structure or status';
  end if;

  return new;
end;
$$;

create trigger departments_guard_structure
  before update on departments
  for each row execute function guard_department_structure();


-- =============================================================
-- Policies: profiles
-- =============================================================

-- All authenticated users read all profiles. These are names and
-- job titles — needed to resolve "submitted by" on a document
-- request or "risk owner" on a matrix, across departments.
-- Email and password live in auth.users, not here.
create policy profiles_select
  on profiles for select
  to authenticated
  using (true);

-- A user maintains their own profile.
create policy profiles_update_own
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- IMS can update any profile, including deactivating someone (US-1.5).
create policy profiles_update_ims
  on profiles for update
  to authenticated
  using (has_role(array['system_admin', 'ims_admin']))
  with check (has_role(array['system_admin', 'ims_admin']));

-- Only IMS creates profiles — they follow from an invite (US-1.3).
create policy profiles_insert
  on profiles for insert
  to authenticated
  with check (has_role(array['system_admin', 'ims_admin']));

-- No delete policy: deactivate via status, never delete (US-1.5).


-- =============================================================
-- Policies: user_roles
-- =============================================================

-- Everyone reads role assignments — the UI needs to show who is
-- responsible for what (US-1.4), and the helper functions read
-- this table.
create policy user_roles_select
  on user_roles for select
  to authenticated
  using (true);

-- Only IMS assigns or removes roles. This is the table that grants
-- all other access, so it is deliberately the narrowest one in the
-- schema — a Department Manager who could write here could grant
-- themselves ims_admin and bypass every other policy.
create policy user_roles_write
  on user_roles for all
  to authenticated
  using (has_role(array['system_admin', 'ims_admin']))
  with check (has_role(array['system_admin', 'ims_admin']));




-- =============================================================
-- Policies: roles (read-only catalogue)
-- =============================================================

create policy roles_select
  on roles for select
  to authenticated
  using (true);

-- No write policies: the eight roles are seeded by migration.
-- With RLS on and no policy, writes are denied to everyone.


-- =============================================================
-- Policies: organization_settings
-- =============================================================

create policy organization_settings_select
  on organization_settings for select
  to authenticated
  using (true);

create policy organization_settings_insert
  on organization_settings for insert
  to authenticated
  with check (has_role(array['system_admin']));

create policy organization_settings_update
  on organization_settings for update
  to authenticated
  using (has_role(array['system_admin']))
  with check (has_role(array['system_admin']));


-- =============================================================
-- Policies: reporting_periods
-- =============================================================

create policy reporting_periods_select
  on reporting_periods for select
  to authenticated
  using (true);

create policy reporting_periods_write
  on reporting_periods for all
  to authenticated
  using (has_role(array['system_admin', 'ims_admin']))
  with check (has_role(array['system_admin', 'ims_admin']));


-- =============================================================
-- Bootstrap
-- =============================================================

-- Every write policy requires an existing admin, and user_roles is
-- the only table that grants roles — so a fresh database has no way
-- to create its first one. This trigger resolves that: when a
-- profile is created and NO role assignments exist anywhere, that
-- person becomes System Admin. Once one row exists in user_roles
-- this can never fire again, so it is a one-time bootstrap rather
-- than an ongoing privilege path.
create or replace function bootstrap_first_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_role_id uuid;
begin
  if exists (select 1 from user_roles) then
    return new;
  end if;

  select id into admin_role_id from roles where key = 'system_admin';

  insert into user_roles (profile_id, role_id, department_id)
  values (new.id, admin_role_id, null);

  return new;
end;
$$;

create trigger profiles_bootstrap_first_admin
  after insert on profiles
  for each row execute function bootstrap_first_admin();


