-- Document approval, two phases (MMCY Process 1 + Process 2): enum values.
-- Kept in its own migration: a value added with ADD VALUE can't be used in
-- the same transaction. Written to be re-runnable (IF NOT EXISTS / guarded).

alter type change_request_status add value if not exists 'pending_coordinator';
alter type change_request_status add value if not exists 'awaiting_draft';
alter type change_request_status add value if not exists 'pending_draft_check';
alter type change_request_status add value if not exists 'draft_returned';
alter type change_request_status add value if not exists 'pending_ims_document';
alter type change_request_status add value if not exists 'pending_final';
alter type change_request_status add value if not exists 'pending_document_control';
alter type change_request_status add value if not exists 'retired';

alter type approval_stage add value if not exists 'coordinator_review';
alter type approval_stage add value if not exists 'draft_check';
alter type approval_stage add value if not exists 'ims_document';
alter type approval_stage add value if not exists 'final';
alter type approval_stage add value if not exists 'document_control';

alter type document_status add value if not exists 'proposed';

alter type notification_type add value if not exists 'change_request_awaiting_coordinator';
alter type notification_type add value if not exists 'change_request_awaiting_draft';
alter type notification_type add value if not exists 'change_request_draft_returned';
alter type notification_type add value if not exists 'change_request_awaiting_final';
alter type notification_type add value if not exists 'change_request_awaiting_document_control';
alter type notification_type add value if not exists 'change_request_retired';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_request_type') then
    create type document_request_type as enum ('new', 'revision', 'deletion');
  end if;
end $$;
