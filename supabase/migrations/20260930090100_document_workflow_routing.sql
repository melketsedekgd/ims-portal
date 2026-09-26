-- Route change requests by the snapshot in document_change_requests.workflow.
-- Bodies are the 20260929090100_document_approval_phases versions; only the
-- lines marked "workflow" change. With every step on, behaviour is identical.

-- ---------------------------------------------------------------------------
-- 1. The state machine
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

  if new.decision = 'rejected' then
    -- Phase 1 goes back as a request to edit; phase 2 as a draft to redo.
    next_status := case
      when new.stage in ('owner', 'coordinator_review', 'ims') then 'rejected'
      else 'draft_returned'
    end::change_request_status;
  else
    next_status := case new.stage
      -- workflow: coordinator review may be switched off.
      when 'owner'              then case when workflow_step_enabled(req.workflow, 'coordinator_review')
                                          then 'pending_coordinator'
                                          else 'pending_ims' end
      when 'coordinator_review' then 'pending_ims'
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

  perform set_config('ims.applying_approval', 'on', true);
  update document_change_requests set status = next_status where id = req.id;
  perform set_config('ims.applying_approval', '', true);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Sending a draft
-- ---------------------------------------------------------------------------
create or replace function public.submit_draft(
  p_request_id uuid,
  p_file_url   text,
  p_note       text default null
)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  req  document_change_requests%rowtype;
  n    smallint;
  d_id uuid;
begin
  select * into req from document_change_requests where id = p_request_id for update;
  if not found then
    raise exception 'Change request not found' using errcode = 'P0002';
  end if;

  -- A null auth.uid() is a seed acting as the requester.
  if auth.uid() is not null and auth.uid() <> req.requester_id then
    raise exception 'Only the requester can send a draft' using errcode = '42501';
  end if;
  if req.status not in ('awaiting_draft', 'draft_returned') then
    raise exception 'A draft can be sent only after phase 1 is approved or a draft is returned (status is %)', req.status
      using errcode = '23514';
  end if;
  if coalesce(btrim(p_file_url), '') = '' then
    raise exception 'A draft needs a file link' using errcode = '23514';
  end if;

  select coalesce(max(draft_number), 0) + 1 into n
  from document_drafts where request_id = req.id;

  insert into document_drafts (request_id, draft_number, file_url, note, submitted_by)
  values (req.id, n, btrim(p_file_url), nullif(btrim(p_note), ''), req.requester_id)
  returning id into d_id;

  perform set_config('ims.applying_approval', 'on', true);
  -- workflow: the coordinator draft check may be switched off.
  update document_change_requests
  set status = case when workflow_step_enabled(req.workflow, 'draft_check')
                    then 'pending_draft_check'
                    else 'pending_ims_document' end::change_request_status
  where id = req.id;
  perform set_config('ims.applying_approval', '', true);

  return d_id;
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
