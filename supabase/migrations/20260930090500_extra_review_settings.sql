-- Up to 3 reviewers from other departments per document type, each "a role in
-- a department". The step sits in phase 1 after coordinator review, before the
-- IMS Manager. Each request snapshots the reviewers when it is raised.

-- ---------------------------------------------------------------------------
-- 1. Settings, up to 3 rows per document type
-- ---------------------------------------------------------------------------
create table document_workflow_extra_reviewers (
  id            uuid primary key default gen_random_uuid(),
  document_type text not null references document_types(key),
  department_id uuid not null references departments(id),
  role_key      text not null
    check (role_key in ('department_manager', 'department_contributor')),
  created_by    uuid references profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (document_type, department_id, role_key)
);

alter table document_workflow_extra_reviewers enable row level security;

create policy document_workflow_extra_reviewers_select on document_workflow_extra_reviewers
  for select to authenticated using (true);
create policy document_workflow_extra_reviewers_insert on document_workflow_extra_reviewers
  for insert to authenticated with check (is_ims_admin());
create policy document_workflow_extra_reviewers_delete on document_workflow_extra_reviewers
  for delete to authenticated using (is_ims_admin());
-- No update policy: change a reviewer by removing it and adding another.

grant select, insert, delete on document_workflow_extra_reviewers to authenticated;

create or replace function public.check_extra_reviewer()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  -- Serialise inserts per type so two at once cannot both pass the count.
  perform 1 from document_types where key = new.document_type for update;

  if (select count(*) from document_workflow_extra_reviewers
      where document_type = new.document_type) >= 3 then
    raise exception 'At most 3 other-department reviewers per document type'
      using errcode = '23514';
  end if;

  if exists (select 1 from departments
             where id = new.department_id and status = 'inactive') then
    raise exception 'An inactive department cannot review documents'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger document_workflow_extra_reviewers_check
  before insert on document_workflow_extra_reviewers
  for each row execute function check_extra_reviewer();

-- ---------------------------------------------------------------------------
-- 2. When the current round of other-department review began
-- ---------------------------------------------------------------------------
alter table document_change_requests
  add column extra_review_started_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Snapshot gains the reviewers
-- ---------------------------------------------------------------------------
-- The document's own department never reviews as "another department", and a
-- slot nobody active holds is left out so it cannot hold a request up.
drop function public.document_workflow_snapshot(text);

create function public.document_workflow_snapshot(
  p_document_type text,
  p_department_id uuid default null
)
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
      'enabled', coalesce(s.final_enabled, true)),
    'extra_review', jsonb_build_object(
      'reviewers', coalesce((
        select jsonb_agg(jsonb_build_object('department_id', x.department_id, 'role', x.role_key)
                         order by x.created_at, x.id)
        from document_workflow_extra_reviewers x
        where x.document_type = p_document_type
          and x.department_id is distinct from p_department_id
          and exists (
            select 1
            from user_roles ur
            join roles r    on r.id = ur.role_id
            join profiles p on p.id = ur.profile_id
            where r.key = x.role_key
              and ur.department_id = x.department_id
              and p.status = 'active')
      ), '[]'::jsonb))
  )
  from (select 1) one
  left join document_workflow_settings s on s.document_type = p_document_type;
$$;

revoke execute on function public.document_workflow_snapshot(text, uuid) from public, anon;
grant execute on function public.document_workflow_snapshot(text, uuid) to authenticated;

create or replace function public.stamp_change_request_workflow()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  doc documents%rowtype;
begin
  if tg_op = 'INSERT' then
    -- Always from the settings; a value sent by the client is ignored.
    select * into doc from documents d where d.id = new.document_id;
    new.workflow := document_workflow_snapshot(doc.document_type, doc.department_id);
    return new;
  end if;

  if new.workflow is distinct from old.workflow then
    raise exception 'The approval steps of a request are fixed when it is raised'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The step is on only when the snapshot lists someone
-- ---------------------------------------------------------------------------
create or replace function public.workflow_step_enabled(p_workflow jsonb, p_stage approval_stage)
returns boolean
language sql immutable
set search_path to 'public'
as $$
  select case p_stage
    when 'coordinator_review' then coalesce((p_workflow -> 'coordinator_review' ->> 'enabled')::boolean, true)
    when 'draft_check'        then coalesce((p_workflow -> 'draft_check'        ->> 'enabled')::boolean, true)
    when 'final'              then coalesce((p_workflow -> 'final'              ->> 'enabled')::boolean, true)
    -- Off by default: a request raised before this step existed has no key.
    when 'extra_review'       then jsonb_array_length(coalesce(p_workflow -> 'extra_review' -> 'reviewers', '[]'::jsonb)) > 0
    else true
  end;
$$;
