-- =============================================================
-- system_admin → folded into ims_admin
-- =============================================================
--
-- IMS administers the system. A second admin tier that nobody holds is a
-- role that drifts out of sync with the one that is used, so every site
-- that named system_admin alongside ims_admin collapses to is_ims_admin().
--
-- Three policies named system_admin alone — departments_delete and the
-- organization_settings pair — and so were held by nobody; they widen to
-- ims_admin here on purpose.
--
-- Functions first, then policies, then the row: the policies reference
-- the functions, and the delete must find zero assignments.

-- -------------------------------------------------------------
-- 1. Functions
-- -------------------------------------------------------------

create or replace function is_ims()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role(array['ims_admin', 'ims_reviewer']);
$$;

create or replace function is_ims_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role(array['ims_admin']);
$$;

comment on function is_ims_admin() is
  'IMS admin only. Excludes ims_reviewer, which is read-only.';

-- The first profile created while user_roles is empty becomes the IMS
-- admin. One-time bootstrap, as before; only the role it grants changes.
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

  select id into admin_role_id from roles where key = 'ims_admin';

  insert into user_roles (profile_id, role_id, department_id)
  values (new.id, admin_role_id, null);

  return new;
end;
$$;

create or replace function guard_department_structure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_ims_admin() then
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

-- -------------------------------------------------------------
-- 2. Policies — altered in place, never dropped
-- -------------------------------------------------------------

alter policy departments_delete on departments
  using (is_ims_admin());

alter policy departments_insert on departments
  with check (is_ims_admin());

alter policy organization_settings_insert on organization_settings
  with check (is_ims_admin());

alter policy organization_settings_update on organization_settings
  using (is_ims_admin())
  with check (is_ims_admin());

alter policy profiles_insert on profiles
  with check (is_ims_admin());

alter policy profiles_update_ims on profiles
  using (is_ims_admin())
  with check (is_ims_admin());

alter policy reporting_periods_write on reporting_periods
  using (is_ims_admin())
  with check (is_ims_admin());

alter policy units_write on units
  using (is_ims_admin())
  with check (is_ims_admin());

alter policy user_roles_write on user_roles
  using (is_ims_admin())
  with check (is_ims_admin());

-- -------------------------------------------------------------
-- 3. The row
-- -------------------------------------------------------------

do $$
declare
  assigned integer;
  removed  integer;
begin
  select count(*) into assigned
    from user_roles ur join roles r on r.id = ur.role_id
   where r.key = 'system_admin';
  if assigned > 0 then
    raise exception 'system_admin is still assigned to % user(s); refusing to delete it', assigned;
  end if;

  delete from roles where key = 'system_admin';
  get diagnostics removed = row_count;
  if removed <> 1 then
    raise exception 'expected to delete exactly one system_admin role row, deleted %', removed;
  end if;
end $$;
