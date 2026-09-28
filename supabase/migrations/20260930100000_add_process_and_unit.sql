-- =============================================================
-- Add a process or a unit from the dropdown that needs it
-- =============================================================
--
-- The KPI, risk and objective forms pick a process, and the KPI forms pick
-- units. Both lists were fixed: a missing entry meant leaving the form. These
-- functions let the dialogs behind "+ Add process…" and "+ Add unit…" create
-- one in place.


-- =============================================================
-- Units: one base unit per dimension
-- =============================================================
--
-- Story points sat in the 'count' dimension with factor 1 alongside 'count'
-- itself: two base units, and story points comparable one-for-one with plain
-- counts. They are not the same thing. No KPI or measurement mixes the two
-- (Average Sprint Velocity is story_pt throughout; the count KPIs are count
-- throughout), so moving story_pt to its own dimension re-scores nothing.
--
-- This runs before guard_unit_in_use exists: story_pt is in use and the guard
-- would refuse the dimension change.

update units
set dimension = 'story_points'
where key = 'story_pt';


-- =============================================================
-- Processes
-- =============================================================

-- Process names are unique per department ignoring case *and* surrounding
-- spaces. The old index compared lower(name) only, so ' Network Management'
-- was a different process from 'Network Management'. Still partial on active:
-- a retired process's name can be reused.
drop index processes_name_active_idx;
create unique index processes_name_active_idx
  on processes (department_id, lower(btrim(name)))
  where status = 'active';

-- The write policies are already scoped to managed departments
-- (20260916090000_scope_structure_writes_to_managed), so nothing changes there.

-- SECURITY INVOKER (the default) on purpose: processes_insert decides who can
-- create (an IMS admin, or a manager of that department).
--
-- display_order continues the department's list. processes_select is open to
-- every signed-in user, so the max is read over the whole department.
create or replace function create_process(
  p_department_id       uuid,
  p_name                text,
  p_governing_document  text default null
)
returns processes
language plpgsql
set search_path = public
as $$
declare
  v_name  text := btrim(p_name);
  v_row   processes;
begin
  if coalesce(v_name, '') = '' then
    raise exception 'A process needs a name'
      using errcode = '23514';
  end if;

  insert into processes (
    department_id,
    name,
    governing_document,
    display_order,
    status
  )
  values (
    p_department_id,
    v_name,
    nullif(btrim(p_governing_document), ''),
    coalesce((
      select max(display_order)
      from processes
      where department_id = p_department_id
    ), 0) + 1,
    'active'
  )
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'A process named "%" already exists in this department', v_name
      using errcode = '23505';
end;
$$;

comment on function create_process(uuid, text, text) is
  'Create an active process at the end of its department''s list. Security invoker: processes_insert applies as the caller. 23505 on a name clash (case and surrounding spaces ignored).';

revoke execute on function create_process(uuid, text, text) from public, anon;
grant execute on function create_process(uuid, text, text) to authenticated;


-- =============================================================
-- Units
-- =============================================================
--
-- A unit's factor_to_base is what makes a target in hours comparable with an
-- actual in minutes. A wrong factor re-scores every KPI that uses the unit, and
-- nothing on screen says so. Hence: department managers may add units, only an
-- IMS admin may change or remove one, and nobody (admins included) may change
-- the key, dimension or factor of a unit something already points at.

alter table units
  add column created_by uuid references profiles(id) default auth.uid();

-- Keys are compared ignoring case: 'Min' next to 'min' would be two units a
-- person cannot tell apart in a dropdown.
create unique index units_key_lower_idx
  on units (lower(key));

-- Exactly one base unit (factor 1) per dimension. The Add unit dialog phrases
-- every conversion as "1 x = n <base>", which needs a single base.
create unique index units_one_base_per_dimension_idx
  on units (dimension)
  where factor_to_base = 1;


-- =============================================================
-- RLS: units
-- =============================================================
--
-- units_select (everyone reads) is unchanged. units_write covered insert,
-- update and delete together for IMS admins only; insert now opens to
-- department managers of any department, since units are shared by all.

drop policy units_write on units;

create policy units_insert
  on units for insert
  to authenticated
  with check (
    is_ims_admin() or has_role(array['department_manager'])
  );

create policy units_update
  on units for update
  to authenticated
  using (is_ims_admin())
  with check (is_ims_admin());

create policy units_delete
  on units for delete
  to authenticated
  using (is_ims_admin());


-- =============================================================
-- guard_unit_in_use
-- =============================================================
--
-- The foreign keys already stop a referenced key being deleted or renamed
-- (23503), but not a change of dimension or factor, which is the change that
-- silently re-scores. import_rows.actual_unit and previous_actual_unit hold
-- unit keys too, without a foreign key, so they are checked here.
--
-- Label edits pass. The trigger binds everyone, IMS admins included.
-- SECURITY DEFINER so the check sees every referencing row, not only those
-- the caller's RLS lets them read.

create or replace function guard_unit_in_use()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.key            is not distinct from old.key
     and new.dimension      is not distinct from old.dimension
     and new.factor_to_base is not distinct from old.factor_to_base then
    return new;
  end if;

  if exists (select 1 from kpis             where target_unit = old.key)
  or exists (select 1 from kpi_measurements where target_unit = old.key)
  or exists (select 1 from kpi_measurements where actual_unit = old.key)
  or exists (select 1 from import_rows      where actual_unit = old.key)
  or exists (select 1 from import_rows      where previous_actual_unit = old.key) then
    raise exception 'unit_in_use'
      using errcode = '42501',
            detail  = format('Unit %s is used by KPIs, measurements or imports; only its label can change.', old.key);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger guard_unit_in_use
  before update or delete on units
  for each row execute function guard_unit_in_use();


-- =============================================================
-- create_unit()
-- =============================================================
--
-- SECURITY INVOKER (the default) on purpose: units_insert decides who can
-- create, and created_by defaults to the caller.
--
-- p_new_dimension = false: the unit joins an existing dimension, and
-- p_factor says how many base units one of it is.
-- p_new_dimension = true: the unit starts a dimension of its own and is its
-- base, so its factor is 1 whatever was passed. The dimension name is stored
-- as a lowercase slug ('Story Points' -> 'story_points').

create or replace function create_unit(
  p_key            text,
  p_label          text,
  p_dimension      text,
  p_factor         numeric,
  p_new_dimension  boolean
)
returns units
language plpgsql
set search_path = public
as $$
declare
  v_key        text := btrim(p_key);
  v_label      text := btrim(p_label);
  v_dimension  text;
  v_factor     numeric;
  v_row        units;
begin
  if coalesce(v_key, '') = '' or length(v_key) > 16 or v_key ~ '\s' then
    raise exception 'A unit symbol is 1 to 16 characters with no spaces'
      using errcode = '23514';
  end if;

  if coalesce(v_label, '') = '' then
    raise exception 'A unit needs a name'
      using errcode = '23514';
  end if;

  if exists (select 1 from units where lower(key) = lower(v_key)) then
    raise exception 'A unit with symbol "%" already exists', v_key
      using errcode = '23505';
  end if;

  if coalesce(p_new_dimension, false) then
    v_dimension := btrim(regexp_replace(lower(coalesce(p_dimension, '')), '[^a-z0-9]+', '_', 'g'), '_');
    v_factor    := 1;

    if v_dimension = '' then
      raise exception 'A new dimension needs a name'
        using errcode = '23514';
    end if;

    if exists (select 1 from units where dimension = v_dimension) then
      raise exception 'Dimension "%" already exists', v_dimension
        using errcode = '23514';
    end if;
  else
    v_dimension := btrim(p_dimension);
    v_factor    := p_factor;

    if not exists (select 1 from units where dimension = v_dimension) then
      raise exception 'Dimension "%" does not exist', coalesce(v_dimension, 'null')
        using errcode = '23514';
    end if;

    if v_factor is null or v_factor <= 0 then
      raise exception 'A conversion factor must be greater than 0'
        using errcode = '23514';
    end if;

    -- A second factor-1 unit would be a second base for the dimension.
    if v_factor = 1 then
      raise exception 'Dimension "%" already has a base unit; a factor of 1 would duplicate it', v_dimension
        using errcode = '23514';
    end if;
  end if;

  insert into units (key, label, dimension, factor_to_base)
  values (v_key, v_label, v_dimension, v_factor)
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'A unit with symbol "%" already exists', v_key
      using errcode = '23505';
end;
$$;

comment on function create_unit(text, text, text, numeric, boolean) is
  'Create a unit in an existing dimension (factor > 0, not 1) or as the base of a new one (factor forced to 1). Security invoker: units_insert applies as the caller. 23505 on a symbol clash ignoring case.';

revoke execute on function create_unit(text, text, text, numeric, boolean) from public, anon;
grant execute on function create_unit(text, text, text, numeric, boolean) to authenticated;
