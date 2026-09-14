-- =============================================================
-- The state machine
-- =============================================================
--
-- Requesters move their own request between draft, pending_owner and
-- (after a rejection) back to pending_owner. Reviewers never set status:
-- they insert an approval row and apply_change_approval() advances the
-- request. A client therefore cannot move a request through review without
-- leaving a decision record, and the approval history is complete by
-- construction.
--
-- Both pass through when auth.uid() is null so seeds and migrations work.

create or replace function guard_change_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seeds and migrations have no auth.uid(). apply_change_approval() sets
  -- the transaction-local flag before it moves a request, so a decision
  -- recorded in document_change_approvals passes; a client setting status
  -- directly does not carry the flag and is refused below.
  if auth.uid() is null
     or current_setting('ims.applying_approval', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_owner') then
      raise exception 'A change request starts as draft or pending_owner, not %', new.status
        using errcode = '23514';
    end if;
    if new.requester_id <> auth.uid() then
      raise exception 'A change request can only be raised on your own behalf'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE. A no-op on status is an edit to the request's text; allowed
  -- for whoever RLS let through, except on a terminal request.
  if old.status = 'approved' then
    raise exception 'An approved change request cannot be changed'
      using errcode = '42501';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if old.status in ('pending_owner', 'pending_ims') then
    raise exception
      'A request under review is moved by recording a decision in document_change_approvals, not by setting its status'
      using errcode = '42501';
  end if;

  -- old.status is draft or rejected here.
  if new.status = 'pending_owner' and old.status in ('draft', 'rejected') then
    if old.requester_id <> auth.uid() then
      raise exception 'Only the requester can submit a change request'
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'A change request cannot move from % to %', old.status, new.status
    using errcode = '23514';
end;
$$;

create trigger document_change_requests_guard_transition
  before insert or update on document_change_requests
  for each row execute function guard_change_request_transition();

-- Publishing the revision here rather than in TypeScript is the point: an
-- approved request that never bumped the revision is the failure this
-- module exists to prevent. security definer so the requester-scoped
-- update policy on the request, and the ims-only insert policy on
-- revisions, do not stop a legitimate decision from taking effect.
create or replace function apply_change_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  req document_change_requests%rowtype;
  required change_request_status;
begin
  select * into req from document_change_requests where id = new.request_id for update;

  required := case new.stage when 'owner' then 'pending_owner' else 'pending_ims' end;
  if req.status <> required then
    raise exception 'A % decision requires the request to be %, but it is %',
      new.stage, required, req.status
      using errcode = '23514';
  end if;

  -- Let the transition guard through for the updates below, and only for
  -- them: cleared before returning so nothing later in the transaction
  -- inherits it.
  perform set_config('ims.applying_approval', 'on', true);

  if new.decision = 'rejected' then
    update document_change_requests set status = 'rejected' where id = req.id;
    perform set_config('ims.applying_approval', '', true);
    return new;
  end if;

  if new.stage = 'owner' then
    update document_change_requests set status = 'pending_ims' where id = req.id;
    perform set_config('ims.applying_approval', '', true);
    return new;
  end if;

  -- ims + approved: approve, publish, bump.
  update document_change_requests set status = 'approved' where id = req.id;

  insert into document_revisions (document_id, revision_label, change_request_id, published_by, published_at)
  values (req.document_id, req.proposed_revision, req.id, new.decided_by, new.decided_at);

  update documents set current_revision = req.proposed_revision where id = req.document_id;

  perform set_config('ims.applying_approval', '', true);
  return new;
end;
$$;

create trigger document_change_approvals_apply
  after insert on document_change_approvals
  for each row execute function apply_change_approval();
