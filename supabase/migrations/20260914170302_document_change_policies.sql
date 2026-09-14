-- =============================================================
-- RLS: controlled document change management
-- =============================================================

alter table documents                 enable row level security;
alter table document_change_requests  enable row level security;
alter table document_change_approvals enable row level security;
alter table document_revisions        enable row level security;

-- Is the current user the owner of a document?
create or replace function owns_document(doc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from documents d
    where d.id = doc and d.owner_id = auth.uid()
  );
$$;

-- ── documents ─────────────────────────────────────────────────
--
-- Controlled documents are organisation-wide. Scoping reads per department
-- would stop anyone requesting a change to a document they work under but
-- do not own.

create policy documents_select
  on documents for select
  to authenticated
  using (true);

create policy documents_insert
  on documents for insert
  to authenticated
  with check (
    is_ims_admin() or department_id in (select my_managed_department_ids())
  );

create policy documents_update
  on documents for update
  to authenticated
  using (
    is_ims_admin() or department_id in (select my_managed_department_ids())
  )
  with check (
    is_ims_admin() or department_id in (select my_managed_department_ids())
  );

-- ── document_change_requests ──────────────────────────────────

create policy document_change_requests_select
  on document_change_requests for select
  to authenticated
  using (
    requester_id = auth.uid()
    or owns_document(document_id)
    or is_ims()
  );

create policy document_change_requests_insert
  on document_change_requests for insert
  to authenticated
  with check (requester_id = auth.uid());

-- The requester moves their own request; reviewers never touch status
-- directly (the transition guard refuses it) — they insert an approval.
create policy document_change_requests_update
  on document_change_requests for update
  to authenticated
  using (requester_id = auth.uid() or is_ims_admin())
  with check (requester_id = auth.uid() or is_ims_admin());

-- No delete policy.

-- ── document_change_approvals ─────────────────────────────────
--
-- Same visibility as the request. Insert is by stage: the document's owner
-- decides the owner stage, an IMS admin the ims stage. No update, no
-- delete: append-only, like risk_assessments was.

create policy document_change_approvals_select
  on document_change_approvals for select
  to authenticated
  using (
    exists (
      select 1 from document_change_requests r
      where r.id = document_change_approvals.request_id
        and (r.requester_id = auth.uid() or owns_document(r.document_id) or is_ims())
    )
  );

create policy document_change_approvals_insert
  on document_change_approvals for insert
  to authenticated
  with check (
    decided_by = auth.uid()
    and (
      (stage = 'owner' and exists (
        select 1 from document_change_requests r
        where r.id = document_change_approvals.request_id
          and owns_document(r.document_id)
      ))
      or (stage = 'ims' and is_ims_admin())
    )
  );

-- ── document_revisions ────────────────────────────────────────
--
-- Readable by everyone; written only by the IMS approval path. The
-- publishing trigger runs security definer, so an IMS admin's approval is
-- what reaches this table. No update, no delete.

create policy document_revisions_select
  on document_revisions for select
  to authenticated
  using (true);

create policy document_revisions_insert
  on document_revisions for insert
  to authenticated
  with check (is_ims_admin());
