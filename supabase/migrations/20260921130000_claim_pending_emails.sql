-- =============================================================
-- claim_pending_emails(): hand notification rows to the mailer, once
-- =============================================================
--
-- Postgres does not send mail. The trigger decides who gets told, inside the
-- transaction that changed the request; this function is how the app asks
-- "what still needs sending?" after that transaction has committed. A failed
-- send can therefore never roll back a decision, because the decision is
-- already durable before the mailer is called at all.
--
-- Claim and mark in one statement. email_attempted_at is set as the rows are
-- handed out, so a second caller — a concurrent request, a retry, two app
-- instances — cannot pick up the same row. FOR UPDATE SKIP LOCKED makes that
-- concurrent case skip the locked rows rather than block behind them.
--
-- "Attempted", not "sent": the column records that this row was handed to the
-- mailer. Whether the mailer succeeded is email_error's job. A row that was
-- claimed and then failed is deliberately not retried, because at-most-once
-- is the safe direction for mail — a duplicate nag is worse than a missing
-- one, and the in-app notification is still there either way.
--
-- The one-hour window does two things: the first run after this migration
-- does not mail out every row left over from testing the trigger, and an
-- outage does not end with a burst of stale mail about requests that have
-- already moved on.
create or replace function claim_pending_emails(
  p_types notification_type[],
  p_limit int default 50
)
returns table (id uuid, email text, type notification_type, link text)
language sql
security definer
set search_path = public, auth
as $$
  with claimed as (
    select n.id
    from notifications n
    where n.email_attempted_at is null
      and n.type = any(p_types)
      and n.created_at > now() - interval '1 hour'
    order by n.created_at
    limit p_limit
    for update skip locked
  ),
  marked as (
    update notifications n
       set email_attempted_at = now()
      from claimed c
     where n.id = c.id
    returning n.id, n.recipient_id, n.type, n.link
  )
  select m.id, u.email::text, m.type, m.link
  from marked m
  join auth.users u on u.id = m.recipient_id;
$$;

comment on function claim_pending_emails(notification_type[], int) is
  'Claims unsent notification rows of the given types from the last hour, marks them attempted, and returns them with the recipient address. service_role only: it returns email addresses.';

-- EXECUTE is granted to PUBLIC by default, which would put every signed-in
-- user one rpc() call away from a list of colleagues' email addresses — and
-- the function is security definer, so RLS would not stop them. Only the
-- server-side mailer may call it.
revoke execute on function claim_pending_emails(notification_type[], int) from public;
revoke execute on function claim_pending_emails(notification_type[], int) from anon;
revoke execute on function claim_pending_emails(notification_type[], int) from authenticated;
grant  execute on function claim_pending_emails(notification_type[], int) to service_role;
