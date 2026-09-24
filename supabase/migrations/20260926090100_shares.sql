-- =============================================================
-- Sharing ticked KPIs and risks
-- =============================================================
--
-- A share is a list of item ids, a period and a note, sent to people. It
-- grants nothing: the recipient reads the items through their own RLS, so
-- an item from a department they cannot read simply does not come back.
--
-- Clients may only SELECT. Every write goes through the SECURITY DEFINER
-- functions below, which check the sender can see each item and may share
-- with each recipient, and write the share, its items, its recipients and
-- their notifications in one transaction.

create table shares (
  id                  uuid primary key default gen_random_uuid(),
  sender_id           uuid not null references profiles (id),
  item_type           text not null check (item_type in ('kpi', 'risk')),
  reporting_period_id uuid not null references reporting_periods (id),
  note                text check (char_length(note) <= 500),
  created_at          timestamptz not null default now()
);

create index shares_sender_id_idx on shares (sender_id);

-- item_id is a kpis.id or a risks.id depending on shares.item_type, so it
-- has no foreign key. Items are soft-deleted, never removed, so an id here
-- keeps pointing at a real row.
create table share_items (
  share_id uuid not null references shares (id) on delete cascade,
  item_id  uuid not null,
  position int  not null,
  primary key (share_id, item_id)
);

create table share_recipients (
  share_id     uuid not null references shares (id) on delete cascade,
  recipient_id uuid not null references profiles (id),
  read_at      timestamptz,
  primary key (share_id, recipient_id)
);

create index share_recipients_recipient_id_idx on share_recipients (recipient_id);

-- -------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------
--
-- A shares policy that reads share_recipients, and a share_recipients
-- policy that reads shares, recurse into each other. These two answer the
-- question without RLS, and only about the caller.

create function i_sent_share(p_share_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from shares s
    where s.id = p_share_id and s.sender_id = auth.uid()
  );
$$;

create function i_received_share(p_share_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from share_recipients sr
    where sr.share_id = p_share_id and sr.recipient_id = auth.uid()
  );
$$;

revoke all on function i_sent_share(uuid), i_received_share(uuid) from public, anon;
grant execute on function i_sent_share(uuid), i_received_share(uuid) to authenticated;

alter table shares           enable row level security;
alter table share_items      enable row level security;
alter table share_recipients enable row level security;

create policy shares_select on shares
  for select to authenticated
  using (sender_id = auth.uid() or i_received_share(id));

create policy share_items_select on share_items
  for select to authenticated
  using (i_sent_share(share_id) or i_received_share(share_id));

-- The sender sees who they sent to and who has read it; a recipient sees
-- only their own row, not who else got it.
create policy share_recipients_select on share_recipients
  for select to authenticated
  using (recipient_id = auth.uid() or i_sent_share(share_id));

-- No write policies, and no write grants either, so a missing policy is
-- not the only thing standing in the way.
revoke all on shares, share_items, share_recipients from anon, authenticated;
grant select on shares, share_items, share_recipients to authenticated;
