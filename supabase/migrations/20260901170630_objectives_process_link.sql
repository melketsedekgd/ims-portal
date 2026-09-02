-- =============================================================
-- Link objectives to processes
-- =============================================================
--
-- Objectives are change initiatives; KPIs measure processes that
-- already run. The two are disjoint in every report we loaded, so
-- achievement still comes from objective_activities. This column is
-- context only: it lets a screen show an objective next to the KPI
-- trend for the process it is trying to improve.
--
-- Nullable on purpose. IT's four objectives target capabilities
-- (access control, endpoint security, monitoring, patching) that are
-- not yet in the process list, so they stay null until IMS defines
-- those processes.
--
-- Do NOT derive objective_measurements.achievement from the KPIs
-- reachable through this column. A process pulls in every KPI under
-- it — Network Management alone has four — and none of them measures
-- the objective.

alter table objectives
  add column process_id uuid references processes(id) on delete restrict;

comment on column objectives.process_id is
  'The process this objective aims to improve. Context for reporting only; not an input to achievement.';

-- Supports "objectives for this process" and the reverse lookup.
create index objectives_process_id_idx
  on objectives (process_id)
  where process_id is not null;


-- An objective and its process must belong to the same department.
-- Postgres check constraints cannot read another table, so this is a
-- trigger. Without it an IT objective can point at an SRD process and
-- the department filter on every dashboard quietly disagrees with the
-- process filter.
create or replace function guard_objective_process_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  process_department_id uuid;
begin
  if new.process_id is null then
    return new;
  end if;

  select p.department_id into process_department_id
  from processes p
  where p.id = new.process_id;

  if process_department_id is distinct from new.department_id then
    raise exception
      'Objective belongs to department % but process % belongs to department %',
      new.department_id, new.process_id, process_department_id;
  end if;

  return new;
end;
$$;

create trigger objectives_guard_process_department
  before insert or update of process_id, department_id on objectives
  for each row execute function guard_objective_process_department();