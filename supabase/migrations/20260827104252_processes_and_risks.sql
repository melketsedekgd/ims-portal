-- =============================================================
-- Processes
-- =============================================================

create type process_status as enum ('active', 'inactive');

-- A department's defined processes. Shared by KPIs and risks:
-- the KPI sheet's "Processes" column and the risk sheet's group
-- headers are the same concept, so both foreign-key here rather
-- than each storing a free-text process name.
create table processes (
  id                   uuid primary key default gen_random_uuid(),
  department_id        uuid not null references departments(id),
  name                 text not null,
  description          text,
  governing_document   text,
  display_order        smallint,
  status               process_status not null default 'active',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index processes_name_active_idx
  on processes (department_id, lower(name))
  where status = 'active';

create trigger processes_set_updated_at
  before update on processes
  for each row execute function set_updated_at();


-- =============================================================
-- RLS: processes
-- =============================================================

alter table processes enable row level security;

-- Everyone reads all processes. Process names appear on risks and
-- KPIs across the organisation, and IMS compares them between
-- departments.
create policy processes_select
  on processes for select
  to authenticated
  using (true);

-- IMS manages any department's processes. A Department Manager
-- manages their own department's.
create policy processes_insert
  on processes for insert
  to authenticated
  with check (
    has_role(array['system_admin', 'ims_admin'])
    or (
      has_role(array['department_manager'])
      and department_id in (select my_department_ids())
    )
  );

create policy processes_update
  on processes for update
  to authenticated
  using (
    has_role(array['system_admin', 'ims_admin'])
    or (
      has_role(array['department_manager'])
      and department_id in (select my_department_ids())
    )
  )
  with check (
    has_role(array['system_admin', 'ims_admin'])
    or (
      has_role(array['department_manager'])
      and department_id in (select my_department_ids())
    )
  );

-- No delete policy: retire via status, per the soft-delete rule.





-- =============================================================
-- Risks
-- =============================================================

create type risk_status as enum ('open', 'treated', 'closed', 'retired');

-- The identity of a risk: what it is, not what it scores.
-- Scores live in risk_assessments, treatment in risk_treatments.
create table risks (
  id                uuid primary key default gen_random_uuid(),
  department_id     uuid not null references departments(id),
  process_id        uuid references processes(id),
  reference_number  smallint,
  affected_assets   text not null,
  threat            text,
  vulnerability     text,
  risk_statement    text,
  risk_owner_title  text,
  status            risk_status not null default 'open',
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger risks_set_updated_at
  before update on risks
  for each row execute function set_updated_at();


-- =============================================================
-- Risk assessments
-- =============================================================

create type assessment_type as enum ('baseline', 'residual');

-- One row per scoring event. Never updated — a re-score is a new
-- row, so the full history of how a risk moved is preserved.
-- 'baseline' is the inherent risk, recorded once. 'residual' is
-- the post-treatment score, re-recorded each reporting period.
create table risk_assessments (
  id                   uuid primary key default gen_random_uuid(),
  risk_id              uuid not null references risks(id) on delete restrict,
  reporting_period_id  uuid references reporting_periods(id),
  type                 assessment_type not null,
  severity             smallint not null,
  likelihood           smallint not null,
  rpn                  smallint generated always as (severity * likelihood) stored,
  assessed_by          uuid references profiles(id),
  assessed_at          timestamptz not null default now(),
  notes                text,

  constraint valid_severity   check (severity between 1 and 5),
  constraint valid_likelihood check (likelihood between 1 and 5)
);

create index risk_assessments_risk_idx
  on risk_assessments (risk_id, type, assessed_at desc);




-- =============================================================
-- Risk treatments
-- =============================================================

create type treatment_status as enum ('planned', 'in_progress', 'completed', 'cancelled');
create type treatment_effectiveness as enum ('maintain', 'correction', 'corrective_action');

-- The treatment plan for a risk. Long-lived — the reports show
-- the same plan running Feb–Dec 2026 across multiple quarters.
create table risk_treatments (
  id                        uuid primary key default gen_random_uuid(),
  risk_id                   uuid not null references risks(id) on delete restrict,
  treatment_solution        text not null,
  monitoring_evidence       text,
  owner_title               text,
  start_date                date,
  target_date               date,
  completed_date            date,
  status                    treatment_status not null default 'planned',
  created_by                uuid references profiles(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint valid_dates check (target_date is null or start_date is null or target_date >= start_date)
);

create trigger risk_treatments_set_updated_at
  before update on risk_treatments
  for each row execute function set_updated_at();


-- Per-period progress on a treatment. The reports re-state
-- effectiveness, deviation and follow-up every quarter while the
-- treatment plan itself stays the same, so these are separate rows
-- rather than columns that get overwritten each quarter.
create table risk_treatment_reviews (
  id                   uuid primary key default gen_random_uuid(),
  treatment_id         uuid not null references risk_treatments(id) on delete restrict,
  reporting_period_id  uuid not null references reporting_periods(id),
  effectiveness        treatment_effectiveness,
  solution_evidence    text,
  reason_for_deviation text,
  followup_measure     text,
  reviewed_by          uuid references profiles(id),
  reviewed_at          timestamptz not null default now()
);

create unique index risk_treatment_reviews_period_idx
  on risk_treatment_reviews (treatment_id, reporting_period_id);




-- =============================================================
-- RLS: risks
-- =============================================================

alter table risks                  enable row level security;
alter table risk_assessments       enable row level security;
alter table risk_treatments        enable row level security;
alter table risk_treatment_reviews enable row level security;


-- IMS sees every department's risks. Everyone else sees their own.
create policy risks_select
  on risks for select
  to authenticated
  using (
    is_ims()
    or department_id in (select my_department_ids())
  );

-- Department users file risks for their own department only.
create policy risks_insert
  on risks for insert
  to authenticated
  with check (
    is_ims()
    or department_id in (select my_department_ids())
  );

create policy risks_update
  on risks for update
  to authenticated
  using (
    is_ims()
    or department_id in (select my_department_ids())
  )
  with check (
    is_ims()
    or department_id in (select my_department_ids())
  );

-- No delete policy: retire via status.


-- Assessments inherit their risk's department scope.
create policy risk_assessments_select
  on risk_assessments for select
  to authenticated
  using (
    exists (
      select 1 from risks r
      where r.id = risk_assessments.risk_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  );

create policy risk_assessments_insert
  on risk_assessments for insert
  to authenticated
  with check (
    exists (
      select 1 from risks r
      where r.id = risk_assessments.risk_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  );

-- No update or delete policies. Assessments are append-only —
-- a re-score is a new row, never an edit (US-3.6).



-- Treatments follow the same parent-scoped pattern.
create policy risk_treatments_select
  on risk_treatments for select
  to authenticated
  using (
    exists (
      select 1 from risks r
      where r.id = risk_treatments.risk_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  );

create policy risk_treatments_insert
  on risk_treatments for insert
  to authenticated
  with check (
    exists (
      select 1 from risks r
      where r.id = risk_treatments.risk_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  );

create policy risk_treatments_update
  on risk_treatments for update
  to authenticated
  using (
    exists (
      select 1 from risks r
      where r.id = risk_treatments.risk_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  )
  with check (
    exists (
      select 1 from risks r
      where r.id = risk_treatments.risk_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  );


-- Reviews scope through treatment → risk → department.
create policy risk_treatment_reviews_select
  on risk_treatment_reviews for select
  to authenticated
  using (
    exists (
      select 1
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = risk_treatment_reviews.treatment_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  );

create policy risk_treatment_reviews_insert
  on risk_treatment_reviews for insert
  to authenticated
  with check (
    exists (
      select 1
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = risk_treatment_reviews.treatment_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  );

create policy risk_treatment_reviews_update
  on risk_treatment_reviews for update
  to authenticated
  using (
    exists (
      select 1
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = risk_treatment_reviews.treatment_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  )
  with check (
    exists (
      select 1
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = risk_treatment_reviews.treatment_id
        and (is_ims() or r.department_id in (select my_department_ids()))
    )
  );

