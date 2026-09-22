-- =============================================================
-- Quarter sign-off: the enums
-- =============================================================
--
-- Alone in its own migration on purpose. A value added by
-- "alter type ... add value" cannot be used until the transaction that
-- added it has committed, so the tables, the RPC and the trigger that
-- reference these values have to arrive in later migrations.

alter type notification_type add value 'quarter_submitted';
alter type notification_type add value 'quarter_returned';
alter type notification_type add value 'quarter_approved';
alter type notification_type add value 'quarter_received';

-- The paper report is signed per department: Prepared by, Approved by,
-- Received by. These are those three signatures plus the two states the
-- paper form has no room for — not started, and sent back.
create type signoff_status as enum (
  'open',
  'submitted',
  'returned',
  'approved',
  'received'
);

-- What someone did, as distinct from where it left the quarter. Kept
-- separate from signoff_status because the decision history records the
-- act ("returned it") and the row records the state.
create type signoff_decision as enum (
  'submit',
  'return',
  'approve',
  'receive'
);
