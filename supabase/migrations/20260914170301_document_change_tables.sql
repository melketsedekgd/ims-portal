-- =============================================================
-- Controlled document change management — enums and tables
-- =============================================================
--
-- Minimal by decision. No workflow / workflow_state / workflow_transition
-- tables: the configurable engine is cut, and the state machine lives in
-- a trigger (next migration). Four tables:
--
--   documents                  the controlled document register
--   document_change_requests   a proposed revision, moved by its requester
--   document_change_approvals  append-only decisions, one per stage
--   document_revisions         what was actually published, and by whom

create type document_status       as enum ('active', 'retired');
create type change_request_status as enum ('draft', 'pending_owner', 'pending_ims', 'approved', 'rejected');
create type approval_stage        as enum ('owner', 'ims');
create type approval_decision     as enum ('approved', 'rejected');

-- current_revision is nullable and seeds as NULL. The quarterly reports
-- name these documents but never give a revision number, and inventing one
-- puts a fabricated value on a compliance screen. The first approved change
-- request sets it.
create table documents (
  id                 uuid primary key default gen_random_uuid(),
  department_id      uuid not null references departments(id),
  process_id         uuid references processes(id),
  name               text not null,
  document_number    text,
  current_revision   text,
  owner_id           uuid not null references profiles(id),
  status             document_status not null default 'active',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger documents_set_updated_at
  before update on documents
  for each row execute function set_updated_at();

create table document_change_requests (
  id                        uuid primary key default gen_random_uuid(),
  document_id               uuid not null references documents(id) on delete restrict,
  requester_id              uuid not null references profiles(id),
  proposed_revision         text not null,
  reason_for_change         text not null,
  description_of_change     text not null,
  affected_processes        text,
  related_iso_requirements  text,
  proposed_effective_date   date,
  status                    change_request_status not null default 'draft',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index document_change_requests_document_idx
  on document_change_requests (document_id, status);

create trigger document_change_requests_set_updated_at
  before update on document_change_requests
  for each row execute function set_updated_at();

-- One row per decision. Never updated or deleted (no policy grants it),
-- so the approval history is the audit trail by construction.
create table document_change_approvals (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references document_change_requests(id) on delete restrict,
  stage        approval_stage not null,
  decision     approval_decision not null,
  decided_by   uuid not null references profiles(id),
  decided_at   timestamptz not null default now(),
  reason       text,

  -- A policy cannot require a field; a constraint can. A rejection with
  -- no stated reason is not a decision anyone can act on.
  constraint rejection_needs_reason
    check (decision <> 'rejected' or coalesce(btrim(reason), '') <> '')
);

create index document_change_approvals_request_idx
  on document_change_approvals (request_id, decided_at);

create table document_revisions (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null references documents(id) on delete restrict,
  revision_label      text not null,
  change_request_id   uuid references document_change_requests(id),
  published_by        uuid not null references profiles(id),
  published_at        timestamptz not null default now()
);

create index document_revisions_document_idx
  on document_revisions (document_id, published_at desc);
