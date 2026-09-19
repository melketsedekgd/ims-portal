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
