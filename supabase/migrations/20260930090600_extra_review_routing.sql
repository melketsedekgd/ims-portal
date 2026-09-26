-- Route change requests through the other-department review step. Everyone
-- listed is asked at once; every slot must approve; any rejection rejects.
-- Bodies are the 20260930090100_document_workflow_routing versions; only the
-- lines marked "extra review" change.

-- ---------------------------------------------------------------------------
-- 1. Who holds a reviewer slot
-- ---------------------------------------------------------------------------
-- One row per slot in the snapshot per active person holding it.
create or replace function public.extra_review_slot_holders(p_workflow jsonb)
returns table (department_id uuid, role text, profile_id uuid)
language sql stable security definer
set search_path to 'public'
as $$
  select s.department_id, s.role, ur.profile_id
  from jsonb_to_recordset(coalesce(p_workflow -> 'extra_review' -> 'reviewers', '[]'::jsonb))
         as s(department_id uuid, role text)
  join roles r      on r.key = s.role
  join user_roles ur on ur.role_id = r.id and ur.department_id = s.department_id
  join profiles p   on p.id = ur.profile_id and p.status = 'active';
$$;

create or replace function public.is_extra_reviewer_of(p_request_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from document_change_requests r
    cross join lateral extra_review_slot_holders(r.workflow) h
    where r.id = p_request_id
      and h.profile_id = auth.uid()
  );
$$;

revoke execute on function public.extra_review_slot_holders(jsonb) from public, anon;
revoke execute on function public.is_extra_reviewer_of(uuid) from public, anon;
grant execute on function public.extra_review_slot_holders(jsonb) to authenticated;
grant execute on function public.is_extra_reviewer_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The state machine
-- ---------------------------------------------------------------------------
create or replace function public.apply_change_approval()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  req         document_change_requests%rowtype;
  required    change_request_status;
  next_status change_request_status;
begin
  select * into req from document_change_requests where id = new.request_id for update;

  -- Document control is recorded by publish_change_request() / retire_document(),
  -- which move the request themselves.
  if new.stage = 'document_control' then
    if current_setting('ims.applying_approval', true) is distinct from 'on' then
      raise exception 'Document control is recorded by publishing or retiring'
        using errcode = '42501';
    end if;
    return new;
  end if;

  required := case new.stage
    when 'owner'              then 'pending_owner'
    when 'coordinator_review' then 'pending_coordinator'
    when 'extra_review'       then 'pending_extra_review'  -- extra review
    when 'ims'                then 'pending_ims'
    when 'draft_check'        then 'pending_draft_check'
    when 'ims_document'       then 'pending_ims_document'
    when 'final'              then 'pending_final'
  end::change_request_status;

  if req.status is distinct from required then
    raise exception 'A % decision requires the request to be %, but it is %',
      new.stage, required, req.status
      using errcode = '23514';
  end if;

  if new.decided_by = req.requester_id then
    raise exception 'You cannot decide a stage of your own request'
      using errcode = '42501';
  end if;

  -- workflow: a coordinator step may be assigned to one coordinator role.
  if new.stage in ('coordinator_review', 'draft_check')
     and not has_role_of(new.decided_by, workflow_stage_roles(req.workflow, new.stage)) then
    raise exception 'This step is set to be decided by another coordinator'
      using errcode = '42501';
  end if;

  -- extra review: the decider holds a slot that has not approved this round.
  -- The new row is already visible here, so it is left out of this check.
  if new.stage = 'extra_review' then
    if not exists (
      select 1 from extra_review_slot_holders(req.workflow) mine
      where mine.profile_id = new.decided_by
    ) then
      raise exception 'You are not listed as a reviewer for this request'
        using errcode = '42501';
    end if;

    if not exists (
      select 1 from extra_review_slot_holders(req.workflow) mine
      where mine.profile_id = new.decided_by
        and not exists (
          select 1
          from document_change_approvals a
          join extra_review_slot_holders(req.workflow) h on h.profile_id = a.decided_by
          where a.request_id = req.id
            and a.id <> new.id
            and a.stage = 'extra_review'
            and a.decision = 'approved'
            and a.decided_at >= req.extra_review_started_at
            and h.department_id = mine.department_id
            and h.role = mine.role)
    ) then
      raise exception 'You have already approved this step'
        using errcode = '23514';
    end if;
  end if;

  if new.decision = 'rejected' then
    -- Phase 1 goes back as a request to edit; phase 2 as a draft to redo.
    next_status := case
      when new.stage in ('owner', 'coordinator_review', 'extra_review', 'ims') then 'rejected'
      else 'draft_returned'
    end::change_request_status;
  else
    next_status := case new.stage
      -- workflow: coordinator review may be switched off.
      -- extra review: then other departments, when the snapshot lists any.
      when 'owner'              then case when workflow_step_enabled(req.workflow, 'coordinator_review')
                                          then 'pending_coordinator'
                                          when workflow_step_enabled(req.workflow, 'extra_review')
                                          then 'pending_extra_review'
                                          else 'pending_ims' end
      when 'coordinator_review' then case when workflow_step_enabled(req.workflow, 'extra_review')
                                          then 'pending_extra_review'
                                          else 'pending_ims' end
      -- extra review: on to the IMS Manager once every slot has approved this
      -- round (the new row counts); until then the status stays.
      when 'extra_review'       then case when not exists (
                                            select 1
                                            from jsonb_to_recordset(coalesce(req.workflow -> 'extra_review' -> 'reviewers', '[]'::jsonb))
                                                   as slot(department_id uuid, role text)
                                            where not exists (
                                              select 1
                                              from document_change_approvals a
                                              join extra_review_slot_holders(req.workflow) h on h.profile_id = a.decided_by
                                              where a.request_id = req.id
                                                and a.stage = 'extra_review'
                                                and a.decision = 'approved'
                                                and a.decided_at >= req.extra_review_started_at
                                                and h.department_id = slot.department_id
                                                and h.role = slot.role))
                                          then 'pending_ims' end
      when 'ims'                then case when req.request_type = 'deletion'
                                          then 'pending_document_control'
                                          else 'awaiting_draft' end
      when 'draft_check'        then 'pending_ims_document'
      -- workflow: CTO/VP final approval may be switched off.
      when 'ims_document'       then case when workflow_step_enabled(req.workflow, 'final')
                                          then 'pending_final'
                                          else 'pending_document_control' end
      when 'final'              then 'pending_document_control'
    end::change_request_status;
  end if;

  -- extra review: an approval that leaves slots open does not move the request.
  if next_status is null then
    return new;
  end if;

  perform set_config('ims.applying_approval', 'on', true);
  -- extra review: each entry to the step starts a new round.
  update document_change_requests
  set status = next_status,
      extra_review_started_at = case when next_status = 'pending_extra_review'
                                     then now() else extra_review_started_at end
  where id = req.id;
  perform set_config('ims.applying_approval', '', true);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Notifications
-- ---------------------------------------------------------------------------
create or replace function public.notify_change_request()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  recipients   uuid[];
  n_type       notification_type;
  n_link       text;
  to_requester boolean := false;
begin
  if new.status = 'draft' then
    return null;
  end if;

  case new.status
    when 'pending_owner' then
      n_type := 'change_request_awaiting_owner';
      recipients := array(select owner_stage_reviewers(new.document_id));

    -- workflow: only the coordinator role(s) the step is assigned to.
    when 'pending_coordinator' then
      n_type := 'change_request_awaiting_coordinator';
      recipients := array(
        select ur.profile_id from user_roles ur join roles r on r.id = ur.role_id
        where r.key = any(workflow_stage_roles(new.workflow, 'coordinator_review')));

    -- extra review: everyone holding a slot in the snapshot.
    when 'pending_extra_review' then
      n_type := 'change_request_awaiting_extra_review';
      recipients := array(
        select distinct h.profile_id from extra_review_slot_holders(new.workflow) h);

    when 'pending_draft_check' then
      n_type := 'change_request_awaiting_coordinator';
      recipients := array(
        select ur.profile_id from user_roles ur join roles r on r.id = ur.role_id
        where r.key = any(workflow_stage_roles(new.workflow, 'draft_check')));

    when 'pending_document_control' then
      n_type := 'change_request_awaiting_document_control';
      recipients := array(
        select ur.profile_id from user_roles ur join roles r on r.id = ur.role_id
        where r.key in ('qms_coordinator', 'isms_coordinator'));

    when 'pending_ims', 'pending_ims_document' then
      n_type := 'change_request_awaiting_ims';
      recipients := array(
        select ur.profile_id from user_roles ur join roles r on r.id = ur.role_id
        where r.key = 'ims_admin');

    when 'pending_final' then
      n_type := 'change_request_awaiting_final';
      recipients := array(
        select ur.profile_id from user_roles ur join roles r on r.id = ur.role_id
        where r.key = 'approver');

    when 'awaiting_draft' then
      n_type := 'change_request_awaiting_draft';  to_requester := true;
    when 'draft_returned' then
      n_type := 'change_request_draft_returned';  to_requester := true;
    when 'rejected' then
      n_type := 'change_request_returned';        to_requester := true;
    when 'published' then
      n_type := 'change_request_published';       to_requester := true;
    when 'retired' then
      n_type := 'change_request_retired';         to_requester := true;
    else
      return null;
  end case;

  if to_requester then
    recipients := array[new.requester_id];
    n_link := '/department/documents/' || new.document_id;
  else
    -- Nobody is asked to decide their own request.
    recipients := array_remove(recipients, new.requester_id);
    n_link := '/department/approvals';
  end if;

  -- Joining profiles drops inactive people and collapses duplicates; the actor
  -- is never told what they just did (a null actor is a seed: keep everyone).
  insert into notifications (recipient_id, actor_id, type, subject_id, link)
  select p.id, auth.uid(), n_type, new.id, n_link
  from profiles p
  where p.id = any(recipients)
    and p.status = 'active'
    and p.id is distinct from auth.uid();

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Listed reviewers can see the request and record their decision
-- ---------------------------------------------------------------------------
drop policy document_change_requests_select  on document_change_requests;
drop policy document_change_approvals_select on document_change_approvals;
drop policy document_change_approvals_insert on document_change_approvals;

create policy document_change_requests_select
  on document_change_requests for select
  to authenticated
  using (
    requester_id = auth.uid()
    or can_review_document(document_id)
    or is_ims()
    or is_extra_reviewer_of(id)
  );

create policy document_change_approvals_select
  on document_change_approvals for select
  to authenticated
  using (
    exists (
      select 1 from document_change_requests r
      where r.id = document_change_approvals.request_id
        and (r.requester_id = auth.uid() or can_review_document(r.document_id) or is_ims()
             or is_extra_reviewer_of(r.id))
    )
  );

create policy document_change_approvals_insert on document_change_approvals
  for insert to authenticated
  with check (
    decided_by = auth.uid()
    and (
      (stage = 'owner' and exists (
         select 1 from document_change_requests r
         where r.id = request_id and can_review_document(r.document_id)))
      or (stage in ('coordinator_review', 'draft_check') and is_doc_coordinator())
      or (stage = 'extra_review' and is_extra_reviewer_of(request_id))
      or (stage in ('ims', 'ims_document') and is_ims_admin())
      or (stage = 'final' and is_executive_approver())
    )
  );
