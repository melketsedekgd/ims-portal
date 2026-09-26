-- Approval steps per document type. IMS admins can switch off the optional
-- steps (coordinator review, draft check, CTO/VP final) and choose which
-- coordinator decides. Each request takes a snapshot of the settings when it
-- is raised, so changing a setting never moves a request already in flight.
-- Defaults reproduce today's chain exactly.

-- ---------------------------------------------------------------------------
-- 1. Settings, one row per document type
-- ---------------------------------------------------------------------------
create table document_workflow_settings (
  document_type              text primary key references document_types(key),
  coordinator_review_enabled boolean not null default true,
  coordinator_review_role    text    not null default 'any'
    check (coordinator_review_role in ('any', 'qms_coordinator', 'isms_coordinator')),
  draft_check_enabled        boolean not null default true,
  draft_check_role           text    not null default 'any'
    check (draft_check_role in ('any', 'qms_coordinator', 'isms_coordinator')),
  final_enabled              boolean not null default true,
  updated_by                 uuid references profiles(id),
  updated_at                 timestamptz not null default now()
);

alter table document_workflow_settings enable row level security;

create policy document_workflow_settings_select on document_workflow_settings
  for select to authenticated using (true);
create policy document_workflow_settings_insert on document_workflow_settings
  for insert to authenticated with check (is_ims_admin());
create policy document_workflow_settings_update on document_workflow_settings
  for update to authenticated using (is_ims_admin()) with check (is_ims_admin());
-- No delete policy: a type without a row falls back to every step on.

grant select, insert, update on document_workflow_settings to authenticated;

create or replace function public.stamp_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger document_workflow_settings_set_updated_at
  before update on document_workflow_settings
  for each row execute function set_updated_at();

create trigger document_workflow_settings_stamp_updated_by
  before update on document_workflow_settings
  for each row execute function stamp_updated_by();

insert into document_workflow_settings (document_type)
select key from document_types
on conflict (document_type) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Snapshot and readers
-- ---------------------------------------------------------------------------
-- A null type or a type without a row gets every step on, either coordinator.
create or replace function public.document_workflow_snapshot(p_document_type text)
returns jsonb
language sql stable security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'coordinator_review', jsonb_build_object(
      'enabled', coalesce(s.coordinator_review_enabled, true),
      'role',    coalesce(s.coordinator_review_role, 'any')),
    'draft_check', jsonb_build_object(
      'enabled', coalesce(s.draft_check_enabled, true),
      'role',    coalesce(s.draft_check_role, 'any')),
    'final', jsonb_build_object(
      'enabled', coalesce(s.final_enabled, true))
  )
  from (select 1) one
  left join document_workflow_settings s on s.document_type = p_document_type;
$$;

revoke execute on function public.document_workflow_snapshot(text) from public, anon;
grant execute on function public.document_workflow_snapshot(text) to authenticated;

-- Only the three optional steps can be off; a missing key means on.
create or replace function public.workflow_step_enabled(p_workflow jsonb, p_stage approval_stage)
returns boolean
language sql immutable
set search_path to 'public'
as $$
  select case p_stage
    when 'coordinator_review' then coalesce((p_workflow -> 'coordinator_review' ->> 'enabled')::boolean, true)
    when 'draft_check'        then coalesce((p_workflow -> 'draft_check'        ->> 'enabled')::boolean, true)
    when 'final'              then coalesce((p_workflow -> 'final'              ->> 'enabled')::boolean, true)
    else true
  end;
$$;

-- The coordinator roles that may decide a step: 'any' or no role means both.
create or replace function public.workflow_stage_roles(p_workflow jsonb, p_stage approval_stage)
returns text[]
language sql immutable
set search_path to 'public'
as $$
  select case
    when coalesce(role_key, 'any') = 'any' then array['qms_coordinator', 'isms_coordinator']
    else array[role_key]
  end
  from (
    select case p_stage
      when 'coordinator_review' then p_workflow -> 'coordinator_review' ->> 'role'
      when 'draft_check'        then p_workflow -> 'draft_check'        ->> 'role'
    end as role_key
  ) r;
$$;

-- ---------------------------------------------------------------------------
-- 3. Each request carries its own snapshot
-- ---------------------------------------------------------------------------
-- The default fills existing rows (no triggers fire); new rows get theirs
-- from the trigger below, so the default is dropped straight after.
alter table document_change_requests
  add column workflow jsonb not null default
    '{"coordinator_review":{"enabled":true,"role":"any"},"draft_check":{"enabled":true,"role":"any"},"final":{"enabled":true}}'::jsonb;

alter table document_change_requests
  alter column workflow drop default;

create or replace function public.stamp_change_request_workflow()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    -- Always from the settings; a value sent by the client is ignored.
    new.workflow := document_workflow_snapshot(
      (select d.document_type from documents d where d.id = new.document_id));
    return new;
  end if;

  if new.workflow is distinct from old.workflow then
    raise exception 'The approval steps of a request are fixed when it is raised'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger document_change_requests_stamp_workflow
  before insert or update on document_change_requests
  for each row execute function stamp_change_request_workflow();
