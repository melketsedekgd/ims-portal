-- =============================================================
-- Add a process or a unit from the dropdown that needs it
-- =============================================================
--
-- The KPI, risk and objective forms pick a process, and the KPI forms pick
-- units. Both lists were fixed: a missing entry meant leaving the form. These
-- functions let the dialogs behind "+ Add process…" and "+ Add unit…" create
-- one in place.


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
