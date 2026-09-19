-- =============================================================
-- Actions and evidence — enums
-- =============================================================
--
-- action_source doubles as evidence.linked_type below: both are a
-- polymorphic (type, id) pointer at a source row, so one enum serves
-- both tables. It carries a value for every table a backfilled evidence
-- row can point at, not just every table an action can point at —
-- objective_measurement and risk_treatment_review exist so evidence can
-- land on the exact quarterly row the free text came from, not the
-- parent objective/treatment.

create type action_source as enum (
  'risk',
  'risk_treatment',
  'risk_treatment_review',
  'kpi',
  'kpi_measurement',
  'objective',
  'objective_measurement',
  'document_change',
  'other'
);

create type action_status as enum (
  'open',
  'in_progress',
  'blocked',
  'completed',
  'cancelled'
);

create type evidence_type as enum (
  'document',
  'link',
  'screenshot',
  'report',
  'ticket',
  'other'
);


-- =============================================================
-- Actions
-- =============================================================
--
-- Created by people, never by a trigger: an overdue treatment or a
-- missed KPI does not open a row here on its own. That rule isn't
-- enforced in SQL — it's a decision about what code we don't write.
--
-- source_type/source_id point at the originating row with no foreign
-- key (Postgres can't FK to one of several tables). Nothing here stops
-- a row from pointing at another department's record; that's enforced
-- separately below, by department_of() and its guard trigger.

create table actions (
  id                     uuid primary key default gen_random_uuid(),
  department_id          uuid not null references departments(id),
  source_type            action_source not null,
  source_id              uuid,
  title                  text not null,
  description            text,
  owner_title            text,          -- job title, not a person: matches
                                        -- risks and objectives, the reports
                                        -- name roles, not people
  priority               smallint,
  start_date             date,
  due_date               date,
  status                 action_status not null default 'open',
  completion_percentage  smallint,
  completed_date         date,
  created_by             uuid references profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint source_id_iff_not_other check (
    (source_type = 'other') = (source_id is null)
  )
);

create trigger actions_set_updated_at
  before update on actions
  for each row execute function set_updated_at();

create index actions_department_idx on actions (department_id, status);
create index actions_source_idx on actions (source_type, source_id);


-- =============================================================
-- RLS: actions
-- =============================================================

alter table actions enable row level security;

-- IMS sees every department's actions; everyone else sees their own.
create policy actions_select
  on actions for select
  to authenticated
  using (
    is_ims()
    or department_id in (select my_department_ids())
  );

-- Only a department manager or IMS admin opens, edits or removes an
-- action. Unlike measurements, an action isn't something a contributor
-- records against their own work — it's assigned.
create policy actions_insert
  on actions for insert
  to authenticated
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );

create policy actions_update
  on actions for update
  to authenticated
  using (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  )
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );

create policy actions_delete
  on actions for delete
  to authenticated
  using (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );
