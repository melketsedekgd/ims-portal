-- Demo data for the two-phase document workflow: one request waiting at every
-- stage, plus finished ones. Replaces the click-test requests. Built through
-- the real path (approval rows drive apply_change_approval(); drafts, publish
-- and retire use their functions), so every row obeys the workflow rules.
-- Remove with supabase/scripts/wipe-demo-documents.sql.

-- ---------------------------------------------------------------------------
-- 1. Remove the click-test data, children first
-- ---------------------------------------------------------------------------
delete from notifications where subject_id in (select id from document_change_requests);
delete from document_drafts;
delete from document_revisions;
delete from document_change_approvals;
delete from document_change_requests;
delete from documents where name in ('Risk Managment', 'password managment', 'hocus pocus');

update documents set current_revision = null, status = 'active',
  document_type = case when name ilike '%work instruction%' then 'work_instruction' else 'procedure' end
where name in ('Patch Management Work Instruction', 'Remote Office Monitoring Work Instruction',
               'Network Management Procedure', 'Email Threat Management Procedure');

-- ---------------------------------------------------------------------------
-- 2. Helpers for this migration only
-- ---------------------------------------------------------------------------
create function pg_temp.uid(p_email text) returns uuid language sql as $$
  select id from auth.users where email = p_email
$$;

create function pg_temp.req(
  p_dept text, p_doc text, p_type document_request_type, p_doc_type text,
  p_revision text, p_reason text, p_description text, p_requester text, p_at timestamptz
) returns uuid language plpgsql as $$
declare
  dept   uuid := (select id from departments where code = p_dept);
  doc_id uuid;
  req_id uuid;
begin
  if p_type = 'new' then
    insert into documents (department_id, process_id, name, document_type, status, created_at)
    values (
      dept,
      (select p.id from processes p where p.department_id = dept
         and p_doc ilike p.name || '%' order by length(p.name) desc limit 1),
      p_doc, p_doc_type, 'proposed', p_at)
    returning id into doc_id;
  else
    select id into doc_id from documents where name = p_doc;
  end if;

  insert into document_change_requests (
    document_id, requester_id, request_type, proposed_revision, reason_for_change,
    description_of_change, affected_processes, supporting_file_url, status, created_at)
  values (
    doc_id, pg_temp.uid(p_requester), p_type, p_revision, p_reason, p_description,
    (select p.name from documents d join processes p on p.id = d.process_id where d.id = doc_id),
    'https://example.sharepoint.com/sites/ims/requests/' || replace(lower(p_doc), ' ', '-') || '.docx',
    'pending_owner', p_at)
  returning id into req_id;

  return req_id;
end;
$$;

create function pg_temp.dec(
  p_req uuid, p_stage approval_stage, p_decision approval_decision,
  p_who text, p_at timestamptz, p_reason text default null
) returns void language sql as $$
  insert into document_change_approvals (request_id, stage, decision, decided_by, decided_at, reason)
  values (p_req, p_stage, p_decision, pg_temp.uid(p_who), p_at, p_reason);
$$;

create function pg_temp.draft(p_req uuid, p_at timestamptz) returns void language plpgsql as $$
declare
  d_id uuid;
  n    int;
  doc  text := (select replace(lower(d.name), ' ', '-') from document_change_requests r
                join documents d on d.id = r.document_id where r.id = p_req);
begin
  select count(*) + 1 into n from document_drafts where request_id = p_req;
  d_id := submit_draft(p_req,
    'https://example.sharepoint.com/sites/ims/drafts/' || doc || '-draft-' || n || '.docx');
  update document_drafts set submitted_at = p_at where id = d_id;
end;
$$;

create function pg_temp.phase1(
  p_req uuid, p_mgr text, p_coord text, p_start timestamptz
) returns void language sql as $$
  select pg_temp.dec(p_req, 'owner',              'approved', p_mgr,               p_start + interval '1 day');
  select pg_temp.dec(p_req, 'coordinator_review', 'approved', p_coord,             p_start + interval '2 days');
  select pg_temp.dec(p_req, 'ims',                'approved', 'ims-admin@ex.com',  p_start + interval '3 days');
$$;

-- ---------------------------------------------------------------------------
-- 3. The requests
-- ---------------------------------------------------------------------------
do $$
declare
  r uuid;
  itc  text := 'it-contributor@ex.com';
  itm  text := 'it-dept-manager@ex.com';
  qms  text := 'qms-coordinator@ex.com';
  isms text := 'isms-coordinator@ex.com';
  ims  text := 'ims-admin@ex.com';
  cto  text := 'cto@ex.com';
begin
  -- Phase 1, waiting on the Department Head
  r := pg_temp.req('IT', 'Backup Management Procedure', 'new', 'procedure', 'Rev 1',
    'Backups run nightly and are tested quarterly, but no procedure defines retention or restore checks.',
    'Write a procedure covering backup schedule, retention, off-site copies and quarterly restore tests.',
    itc, '2026-09-23 09:00+03');

  -- Phase 1, waiting on QMS/ISMS
  r := pg_temp.req('IT', 'Patch Management Work Instruction', 'revision', null, 'Rev 2',
    'The monthly patch window moved to the second weekend; the work instruction still describes the old schedule.',
    'Update section 3 (schedule) and section 5 (rollback steps). Add the emergency path for critical CVEs.',
    itc, '2026-09-21 10:00+03');
  perform pg_temp.dec(r, 'owner', 'approved', itm, '2026-09-22 11:00+03');

  -- Phase 1, waiting on the IMS Manager
  r := pg_temp.req('IT', 'Access Control Procedure', 'new', 'procedure', 'Rev 1',
    'Access reviews are done but not written down; auditors asked for the procedure.',
    'Define joiner/mover/leaver steps, quarterly access reviews and privileged account handling.',
    itc, '2026-09-18 09:30+03');
  perform pg_temp.dec(r, 'owner', 'approved', itm, '2026-09-19 10:00+03');
  perform pg_temp.dec(r, 'coordinator_review', 'approved', isms, '2026-09-22 14:00+03');

  -- Phase 2, waiting for the requester's draft
  r := pg_temp.req('IT', 'Incident Management Procedure', 'new', 'procedure', 'Rev 1',
    'Incidents are logged in the help desk tool but severity levels and escalation are not defined.',
    'Define severity levels, response times, escalation path and post-incident review.',
    itc, '2026-09-14 09:00+03');
  perform pg_temp.phase1(r, itm, qms, '2026-09-14 09:00+03');

  -- Phase 2, draft 2 waiting on the needs-edit check after one return
  r := pg_temp.req('IT', 'Network Management Procedure', 'revision', null, 'Rev 2',
    'Latency and packet-loss targets changed this year; the procedure still quotes the old thresholds.',
    'Update the monitoring thresholds in section 4 and the escalation contacts in section 6.',
    itc, '2026-09-08 09:00+03');
  perform pg_temp.phase1(r, itm, isms, '2026-09-08 09:00+03');
  perform pg_temp.draft(r, '2026-09-15 16:00+03');
  perform pg_temp.dec(r, 'draft_check', 'rejected', qms, '2026-09-17 10:00+03',
    'Section 4 still lists the 2025 jitter target. Use the current KPI targets.');
  perform pg_temp.draft(r, '2026-09-24 12:00+03');

  -- Phase 2, waiting on the IMS Manager
  r := pg_temp.req('IT', 'Configuration Management Procedure', 'new', 'procedure', 'Rev 1',
    'Configuration changes to network devices are not recorded consistently.',
    'Define the configuration baseline, change recording and monthly baseline review.',
    itc, '2026-09-07 09:00+03');
  perform pg_temp.phase1(r, itm, qms, '2026-09-07 09:00+03');
  perform pg_temp.draft(r, '2026-09-16 15:00+03');
  perform pg_temp.dec(r, 'draft_check', 'approved', isms, '2026-09-18 11:00+03');

  -- Phase 2, waiting on the CTO/VP (SRD)
  r := pg_temp.req('SRD', 'Software Development Procedure', 'new', 'procedure', 'Rev 1',
    'Sprint, review and release practice is agreed but not documented as a controlled procedure.',
    'Document the sprint cycle, code review rules, release approval and version numbering.',
    'srd-contributor@ex.com', '2026-09-01 09:00+03');
  perform pg_temp.phase1(r, 'srd-dept-manager@ex.com', isms, '2026-09-01 09:00+03');
  perform pg_temp.draft(r, '2026-09-10 17:00+03');
  perform pg_temp.dec(r, 'draft_check', 'approved', qms, '2026-09-14 10:00+03');
  perform pg_temp.dec(r, 'ims_document', 'approved', ims, '2026-09-18 15:00+03');

  -- Document control, waiting to be published (the mockup's example)
  r := pg_temp.req('IT', 'Remote Office Monitoring Work Instruction', 'revision', null, 'Rev 1',
    'Remote Office Monitoring runs without a written instruction. Its KPIs are reported every quarter, but nothing defines the checks.',
    'Write the checks, their frequency and the escalation contacts into the work instruction.',
    itc, '2026-09-08 09:00+03');
  perform pg_temp.phase1(r, itm, isms, '2026-09-08 09:00+03');
  perform pg_temp.draft(r, '2026-09-15 11:00+03');
  perform pg_temp.dec(r, 'draft_check', 'rejected', qms, '2026-09-16 10:00+03',
    'Add the escalation contacts to section 4 and say how often the remote checks run.');
  perform pg_temp.draft(r, '2026-09-18 11:00+03');
  perform pg_temp.dec(r, 'draft_check', 'approved', qms, '2026-09-19 10:00+03');
  perform pg_temp.dec(r, 'ims_document', 'approved', ims, '2026-09-21 10:00+03');
  perform pg_temp.dec(r, 'final', 'approved', cto, '2026-09-23 10:00+03');

  -- Document control, deletion waiting to be retired (skips phase 2)
  r := pg_temp.req('IT', 'Email Threat Management Procedure', 'deletion', null, null,
    'Email threat handling is now covered by the Incident Management Procedure being written.',
    'Retire this procedure once the Incident Management Procedure is published.',
    itc, '2026-09-17 09:00+03');
  perform pg_temp.phase1(r, itm, qms, '2026-09-17 09:00+03');

  -- Finished: published after one returned draft
  r := pg_temp.req('IT', 'Help Desk and User Support Procedure', 'new', 'procedure', 'Rev 1',
    'Help desk response targets are measured as KPIs but the support process is not documented.',
    'Document ticket intake, priorities, response targets and user satisfaction follow-up.',
    itc, '2026-08-10 09:00+03');
  perform pg_temp.phase1(r, itm, qms, '2026-08-10 09:00+03');
  perform pg_temp.draft(r, '2026-08-17 10:00+03');
  perform pg_temp.dec(r, 'draft_check', 'rejected', isms, '2026-08-18 10:00+03',
    'Priority levels must match the help desk KPI definitions.');
  perform pg_temp.draft(r, '2026-08-20 10:00+03');
  perform pg_temp.dec(r, 'draft_check', 'approved', isms, '2026-08-21 10:00+03');
  perform pg_temp.dec(r, 'ims_document', 'approved', ims, '2026-08-24 10:00+03');
  perform pg_temp.dec(r, 'final', 'approved', cto, '2026-08-26 10:00+03');
  perform publish_change_request(r, 'Rev 1', 'MMCY/IT/PR/021', null, '2026-09-01', pg_temp.uid(isms));

  -- Finished: published straight through
  r := pg_temp.req('IT', 'Business Continuity Plan', 'new', 'manual', 'Rev 1',
    'Failover tests are run twice a year; the plan they test against must be a controlled document.',
    'Bring the continuity plan under document control with owners, recovery targets and test schedule.',
    itc, '2026-08-03 09:00+03');
  perform pg_temp.phase1(r, itm, isms, '2026-08-03 09:00+03');
  perform pg_temp.draft(r, '2026-08-11 10:00+03');
  perform pg_temp.dec(r, 'draft_check', 'approved', qms, '2026-08-12 10:00+03');
  perform pg_temp.dec(r, 'ims_document', 'approved', ims, '2026-08-14 10:00+03');
  perform pg_temp.dec(r, 'final', 'approved', cto, '2026-08-17 10:00+03');
  perform publish_change_request(r, 'Rev 1', 'MMCY/IT/MN/004', null, '2026-08-20', pg_temp.uid(qms));

  -- Finished: returned by the Department Head in phase 1
  r := pg_temp.req('IT', 'IT Purchase Procedure', 'new', 'procedure', 'Rev 1',
    'Purchases are approved by email.',
    'Write a purchasing procedure.',
    itc, '2026-09-10 09:00+03');
  perform pg_temp.dec(r, 'owner', 'rejected', itm, '2026-09-11 09:00+03',
    'Purchasing is owned by Finance. Raise it with them, or limit this to IT asset requests.');
end $$;

-- Publish/retire stamp now(); move them onto the demo timeline.
update document_revisions v
set published_at = a.decided_at + interval '2 days'
from document_change_approvals a
where a.request_id = v.change_request_id and a.stage = 'final';

update document_change_approvals c
set decided_at = v.published_at
from document_revisions v
where v.change_request_id = c.request_id and c.stage = 'document_control';

-- The seed's own notifications are not news to anyone.
delete from notifications where subject_id in (select id from document_change_requests);
