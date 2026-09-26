-- 1. decided_at is always the server's clock: the other-department step
--    counts approvals by it, so a client-sent value must not decide a round.
-- 2. A reviewer slot with no active holder other than the requester counts as
--    satisfied, so it cannot hold a request up. Body is the
--    20260930090600_extra_review_routing version; only lines marked
--    "skip slots" change.

-- ---------------------------------------------------------------------------
-- 1. Server-side decided_at
-- ---------------------------------------------------------------------------
create or replace function public.stamp_decided_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.decided_at := now();
  return new;
end;
$$;

create trigger document_change_approvals_stamp_decided_at
  before insert on document_change_approvals
  for each row execute function stamp_decided_at();

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
  -- skip slots: false when every slot is one nobody but the requester can fill.
  extra_review_needed boolean;
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

  -- skip slots: a slot with no active holder other than the requester counts
  -- as satisfied, so the step is needed only while some slot can be filled.
  extra_review_needed := workflow_step_enabled(req.workflow, 'extra_review') and exists (
    select 1
    from jsonb_to_recordset(coalesce(req.workflow -> 'extra_review' -> 'reviewers', '[]'::jsonb))
           as slot(department_id uuid, role text)
    join extra_review_slot_holders(req.workflow) h
      on h.department_id = slot.department_id and h.role = slot.role
    where h.profile_id <> req.requester_id);

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
                                          when extra_review_needed  -- skip slots
                                          then 'pending_extra_review'
                                          else 'pending_ims' end
      when 'coordinator_review' then case when extra_review_needed  -- skip slots
                                          then 'pending_extra_review'
                                          else 'pending_ims' end
      -- extra review: on to the IMS Manager once every slot has approved this
      -- round (the new row counts); until then the status stays.
      when 'extra_review'       then case when not exists (
                                            select 1
                                            from jsonb_to_recordset(coalesce(req.workflow -> 'extra_review' -> 'reviewers', '[]'::jsonb))
                                                   as slot(department_id uuid, role text)
                                            -- skip slots: only a slot someone else can fill must approve.
                                            where exists (
                                              select 1 from extra_review_slot_holders(req.workflow) h
                                              where h.department_id = slot.department_id
                                                and h.role = slot.role
                                                and h.profile_id <> req.requester_id)
                                              and not exists (
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
