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

-- -------------------------------------------------------------
-- Visibility for a given user
-- -------------------------------------------------------------
--
-- share_access_check has to answer "can this other person read that KPI",
-- and the answer must be the one RLS gives, not a copy of it that can
-- drift. So the bodies of has_role() and my_department_ids() move into
-- versions that take the user, and the originals become calls to them
-- with auth.uid(). Every policy that used the originals is unchanged and
-- now runs the same code the share check does.

create function has_role_of(p_user uuid, role_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.profile_id = p_user
      and r.key = any(role_keys)
  );
$$;

create function department_ids_of(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ur.department_id
  from user_roles ur
  where ur.profile_id = p_user
    and ur.department_id is not null;
$$;

create or replace function has_role(role_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role_of(auth.uid(), role_keys);
$$;

create or replace function my_department_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_ids_of(auth.uid());
$$;

-- The kpis_select / risks_select rule, for any user:
--   is_ims() or department_id in (select my_department_ids())
-- is_ims() is has_role(array['ims_admin']). A null department is readable
-- by IMS only, as under RLS, where "null in (...)" is not true.
create function item_visible_to(p_user uuid, p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role_of(p_user, array['ims_admin'])
      or exists (
           select 1 from department_ids_of(p_user) d
           where d = p_department_id
         );
$$;

-- The department of each id that exists, from the table item_type names.
create function share_item_departments(p_item_type text, p_ids uuid[])
returns table (id uuid, department_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select k.id, k.department_id from kpis k
  where p_item_type = 'kpi' and k.id = any(p_ids)
  union all
  select r.id, r.department_id from risks r
  where p_item_type = 'risk' and r.id = any(p_ids);
$$;

-- Internal: they take any user id, so they answer questions about other
-- people. Only the functions below call them, as their owner.
revoke all on function has_role_of(uuid, text[]), department_ids_of(uuid),
  item_visible_to(uuid, uuid), share_item_departments(text, uuid[])
  from public, anon, authenticated;

-- -------------------------------------------------------------
-- Who you can share with
-- -------------------------------------------------------------
--
-- One row per person per group, and the only definition of the rule:
-- can_share_with() asks whether the target is in this list.
--
--   IMS admins        group 'IMS', for everyone
--   Viewer / Auditor  shown to IMS callers only
--   department roles  that department's group, for an IMS caller every
--                     active department, otherwise only the caller's own
--
-- Inactive departments are no group at all, so a person whose only roles
-- are in one is nobody's recipient. Never yourself, never an inactive
-- profile.
create function list_share_recipients()
returns table (
  profile_id uuid,
  full_name  text,
  job_title  text,
  group_code text,
  group_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id, is_ims() as ims
  ),
  grouped as (
    select ur.profile_id, 0 as group_order, 'IMS'::text as code, 'IMS'::text as name
    from user_roles ur
    join roles r on r.id = ur.role_id
    where r.key = 'ims_admin'

    union

    select ur.profile_id, 2, 'Viewer / Auditor', 'Viewer / Auditor'
    from user_roles ur
    join roles r on r.id = ur.role_id
    cross join me
    where r.key = 'viewer' and me.ims

    union

    select ur.profile_id, 1, d.code, d.name
    from user_roles ur
    join departments d on d.id = ur.department_id
    cross join me
    where d.status = 'active'
      and (me.ims or d.id in (select department_ids_of(me.id)))
  )
  select p.id, p.full_name, p.job_title, g.code, g.name
  from grouped g
  join profiles p on p.id = g.profile_id
  cross join me
  where me.id is not null
    and p.status = 'active'
    and p.id <> me.id
  order by g.group_order, g.code, p.full_name;
$$;

create function can_share_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from list_share_recipients() r where r.profile_id = target
  );
$$;

-- The ids, of those the caller can see, that the target cannot. Ids the
-- caller cannot see are left out, so the answer says nothing about them.
create function share_access_check(target uuid, p_item_type text, p_ids uuid[])
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not can_share_with(target) then
    raise exception 'share_recipient_not_allowed' using errcode = '42501';
  end if;

  return array(
    select i.id
    from share_item_departments(p_item_type, p_ids) i
    where item_visible_to(auth.uid(), i.department_id)
      and not item_visible_to(target, i.department_id)
    order by array_position(p_ids, i.id)
  );
end;
$$;

-- -------------------------------------------------------------
-- Writes
-- -------------------------------------------------------------

-- All or nothing: one id the caller cannot see, or one recipient they may
-- not share with, and nothing is written. Error messages start with a
-- 'share_' code that lib/save-errors.ts turns into words.
create function create_share(
  p_item_type  text,
  p_ids        uuid[],
  p_recipients uuid[],
  p_note       text,
  p_year       int,
  p_quarter    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me         uuid := auth.uid();
  v_ids        uuid[];
  v_recipients uuid[];
  v_note       text := nullif(btrim(coalesce(p_note, '')), '');
  v_period     uuid;
  v_share      uuid;
begin
  if v_me is null then
    raise exception 'share_not_signed_in' using errcode = '42501';
  end if;

  if p_item_type is null or p_item_type not in ('kpi', 'risk') then
    raise exception 'share_invalid: unknown item type' using errcode = '22023';
  end if;

  -- Duplicates dropped, first position kept.
  select array_agg(u.id order by u.pos) into v_ids
  from (
    select x.id, min(x.ord) as pos
    from unnest(p_ids) with ordinality as x(id, ord)
    where x.id is not null
    group by x.id
  ) u;

  select array_agg(distinct r) into v_recipients
  from unnest(p_recipients) r
  where r is not null;

  if coalesce(cardinality(v_ids), 0) not between 1 and 200 then
    raise exception 'share_invalid: between 1 and 200 items' using errcode = '22023';
  end if;
  if coalesce(cardinality(v_recipients), 0) not between 1 and 20 then
    raise exception 'share_invalid: between 1 and 20 recipients' using errcode = '22023';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'share_invalid: note over 500 characters' using errcode = '22023';
  end if;

  select rp.id into v_period
  from reporting_periods rp
  where rp.year = p_year and rp.label = p_quarter and rp.type = 'quarterly';
  if v_period is null then
    raise exception 'share_invalid: no such quarter' using errcode = '22023';
  end if;

  -- An id that does not exist and one the caller cannot read look the same.
  if exists (
    select 1 from unnest(v_ids) as x(id)
    where not exists (
      select 1 from share_item_departments(p_item_type, v_ids) i
      where i.id = x.id and item_visible_to(v_me, i.department_id)
    )
  ) then
    raise exception 'share_item_not_visible' using errcode = '42501';
  end if;

  if exists (
    select 1 from unnest(v_recipients) as r(id) where not can_share_with(r.id)
  ) then
    raise exception 'share_recipient_not_allowed' using errcode = '42501';
  end if;

  insert into shares (sender_id, item_type, reporting_period_id, note)
  values (v_me, p_item_type, v_period, v_note)
  returning id into v_share;

  insert into share_items (share_id, item_id, position)
  select v_share, x.id, x.ord
  from unnest(v_ids) with ordinality as x(id, ord);

  insert into share_recipients (share_id, recipient_id)
  select v_share, r from unnest(v_recipients) r;

  -- can_share_with already ruled out yourself and inactive profiles.
  insert into notifications (recipient_id, actor_id, type, subject_id, link)
  select r, v_me, 'items_shared', v_share, '/shared/' || v_share
  from unnest(v_recipients) r;

  return v_share;
end;
$$;

-- Marks the share and its bell entry read for the caller. A no-op for
-- anyone who is not a recipient.
create function mark_share_read(p_share_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update share_recipients
     set read_at = now()
   where share_id = p_share_id
     and recipient_id = auth.uid()
     and read_at is null;

  update notifications
     set read_at = now()
   where recipient_id = auth.uid()
     and type = 'items_shared'
     and subject_id = p_share_id
     and read_at is null;
$$;

revoke all on function list_share_recipients(), can_share_with(uuid),
  share_access_check(uuid, text, uuid[]),
  create_share(text, uuid[], uuid[], text, int, text),
  mark_share_read(uuid)
  from public, anon;
grant execute on function list_share_recipients(), can_share_with(uuid),
  share_access_check(uuid, text, uuid[]),
  create_share(text, uuid[], uuid[], text, int, text),
  mark_share_read(uuid)
  to authenticated;
