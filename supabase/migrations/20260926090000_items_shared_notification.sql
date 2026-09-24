-- =============================================================
-- Sharing: notification type
-- =============================================================
--
-- On its own, ahead of the migration that uses it: a value added by
-- ALTER TYPE ... ADD VALUE cannot be used in the transaction that adds it.
--
-- Deliberately absent from EMAIL_TYPES in features/notifications/email.ts.
-- A share is bell-only for now.
alter type notification_type add value if not exists 'items_shared';
