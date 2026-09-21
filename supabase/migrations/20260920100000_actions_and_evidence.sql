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


-- =============================================================
-- Evidence
-- =============================================================
--
-- Additive, not a replacement. kpi_measurements.evidence_reference,
-- objective_measurements.evidence_reference, risk_treatments
-- .monitoring_evidence and risk_treatment_reviews.solution_evidence stay
-- exactly as they are — this table does not absorb them, and a later
-- migration backfills copies into it. Two sources of truth is accepted
-- deliberately for now: audit_logs doesn't exist yet, so nothing could
-- tell us which copy changed if we tried to reconcile them.
--
-- linked_type/linked_id is the same polymorphic-pointer shape as
-- actions.source_type/source_id, reusing action_source rather than a
-- second enum.

create table evidence (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references departments(id),
  linked_type    action_source not null,
  linked_id      uuid not null,
  name           text not null,
  type           evidence_type not null,
  location       text,                        -- link or file reference
  source         text not null default 'app', -- 'backfill' for migrated rows
  uploaded_by    uuid references profiles(id),
  uploaded_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger evidence_set_updated_at
  before update on evidence
  for each row execute function set_updated_at();

create index evidence_department_idx on evidence (department_id);
create index evidence_linked_idx on evidence (linked_type, linked_id);


-- =============================================================
-- RLS: evidence
-- =============================================================

alter table evidence enable row level security;

create policy evidence_select
  on evidence for select
  to authenticated
  using (
    is_ims()
    or department_id in (select my_department_ids())
  );

create policy evidence_insert
  on evidence for insert
  to authenticated
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );

create policy evidence_update
  on evidence for update
  to authenticated
  using (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  )
  with check (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );

create policy evidence_delete
  on evidence for delete
  to authenticated
  using (
    is_ims_admin()
    or department_id in (select my_managed_department_ids())
  );


-- =============================================================
-- department_of() — resolve a polymorphic pointer's department
-- =============================================================
--
-- Shared by both guard triggers below. Walks up from the pointed-at row
-- to the department that owns it. Returns null for 'other' (nothing to
-- resolve) and for any id that doesn't exist — callers treat null as
-- "nothing to check against", not as an error.

create or replace function department_of(p_type text, p_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result uuid;
begin
  if p_id is null then
    return null;
  end if;

  case p_type
    when 'risk' then
      select r.department_id into result
      from risks r
      where r.id = p_id;

    when 'risk_treatment' then
      select r.department_id into result
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = p_id;

    when 'risk_treatment_review' then
      select r.department_id into result
      from risk_treatment_reviews v
      join risk_treatments t on t.id = v.treatment_id
      join risks r on r.id = t.risk_id
      where v.id = p_id;

    when 'kpi' then
      select k.department_id into result
      from kpis k
      where k.id = p_id;

    when 'kpi_measurement' then
      select k.department_id into result
      from kpi_measurements m
      join kpis k on k.id = m.kpi_id
      where m.id = p_id;

    when 'objective' then
      select o.department_id into result
      from objectives o
      where o.id = p_id;

    when 'objective_measurement' then
      select o.department_id into result
      from objective_measurements m
      join objectives o on o.id = m.objective_id
      where m.id = p_id;

    when 'document_change' then
      select d.department_id into result
      from document_change_requests cr
      join documents d on d.id = cr.document_id
      where cr.id = p_id;

    else
      result := null;
  end case;

  return result;
end;
$$;

comment on function department_of(text, uuid) is
  'Resolves the owning department for a polymorphic (type, id) pointer used by actions.source and evidence.linked. Returns null for ''other'' or an unresolved id.';


-- =============================================================
-- Polymorphic department guards
-- =============================================================
--
-- Same shape as guard_objective_process_department(): a check constraint
-- can't read another table, so cross-referencing the department a
-- polymorphic pointer resolves to has to be a trigger. When department_of
-- can't resolve anything (null id, 'other', or a stale id) there's
-- nothing to compare against, so the row is allowed through.

create or replace function guard_action_source_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_department_id uuid;
begin
  resolved_department_id := department_of(new.source_type::text, new.source_id);

  if resolved_department_id is not null
     and resolved_department_id is distinct from new.department_id then
    raise exception
      'Action department % does not match % department %',
      new.department_id, new.source_type, resolved_department_id;
  end if;

  return new;
end;
$$;

create trigger actions_guard_source_department
  before insert or update of source_type, source_id, department_id on actions
  for each row execute function guard_action_source_department();


create or replace function guard_evidence_linked_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_department_id uuid;
begin
  resolved_department_id := department_of(new.linked_type::text, new.linked_id);

  if resolved_department_id is not null
     and resolved_department_id is distinct from new.department_id then
    raise exception
      'Evidence department % does not match % department %',
      new.department_id, new.linked_type, resolved_department_id;
  end if;

  return new;
end;
$$;

create trigger evidence_guard_linked_department
  before insert or update of linked_type, linked_id, department_id on evidence
  for each row execute function guard_evidence_linked_department();


-- =============================================================
-- Backfill evidence from the four free-text columns
-- =============================================================
--
-- Source columns are read-only here — nothing is dropped, renamed or
-- nulled. Null, empty and whitespace-only values are skipped. A value is
-- typed 'link' only when it's obviously a URL; everything else is
-- 'other', since a bare filename or ticket number isn't safely
-- classifiable from text alone. department_id is taken from each row's
-- own parent, never assumed.

insert into evidence (department_id, linked_type, linked_id, name, type, source, uploaded_by)
select
  k.department_id,
  'kpi_measurement'::action_source,
  m.id,
  btrim(m.evidence_reference),
  case when btrim(m.evidence_reference) ~* '^https?://'
    then 'link' else 'other' end::evidence_type,
  'backfill',
  null
from kpi_measurements m
join kpis k on k.id = m.kpi_id
where btrim(coalesce(m.evidence_reference, '')) <> '';

insert into evidence (department_id, linked_type, linked_id, name, type, source, uploaded_by)
select
  o.department_id,
  'objective_measurement'::action_source,
  m.id,
  btrim(m.evidence_reference),
  case when btrim(m.evidence_reference) ~* '^https?://'
    then 'link' else 'other' end::evidence_type,
  'backfill',
  null
from objective_measurements m
join objectives o on o.id = m.objective_id
where btrim(coalesce(m.evidence_reference, '')) <> '';

insert into evidence (department_id, linked_type, linked_id, name, type, source, uploaded_by)
select
  r.department_id,
  'risk_treatment'::action_source,
  t.id,
  btrim(t.monitoring_evidence),
  case when btrim(t.monitoring_evidence) ~* '^https?://'
    then 'link' else 'other' end::evidence_type,
  'backfill',
  null
from risk_treatments t
join risks r on r.id = t.risk_id
where btrim(coalesce(t.monitoring_evidence, '')) <> '';

insert into evidence (department_id, linked_type, linked_id, name, type, source, uploaded_by)
select
  r.department_id,
  'risk_treatment_review'::action_source,
  v.id,
  btrim(v.solution_evidence),
  case when btrim(v.solution_evidence) ~* '^https?://'
    then 'link' else 'other' end::evidence_type,
  'backfill',
  null
from risk_treatment_reviews v
join risk_treatments t on t.id = v.treatment_id
join risks r on r.id = t.risk_id
where btrim(coalesce(v.solution_evidence, '')) <> '';


-- =============================================================
-- v_open_action_items
-- =============================================================
--
-- security_invoker = true is load-bearing: without it the view runs as
-- its owner and bypasses RLS entirely, showing every department's
-- actions to everyone who can select from it.

create view v_open_action_items
  with (security_invoker = true)
as
select
  a.id,
  a.department_id,
  d.name as department_name,
  a.source_type,
  a.source_id,
  a.title,
  a.description,
  a.owner_title,
  a.priority,
  a.start_date,
  a.due_date,
  a.status,
  a.completion_percentage,
  a.completed_date,
  a.created_by,
  a.created_at,
  a.updated_at
from actions a
join departments d on d.id = a.department_id
where a.status not in ('completed', 'cancelled');
