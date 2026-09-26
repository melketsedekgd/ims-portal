-- Enum values for the other-department review step. On their own: a new enum
-- value cannot be used in the transaction that adds it.
alter type approval_stage add value 'extra_review';
alter type change_request_status add value 'pending_extra_review';
alter type notification_type add value 'change_request_awaiting_extra_review';
