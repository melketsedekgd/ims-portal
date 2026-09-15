-- =============================================================
-- Documents become a derived index, not a register
-- =============================================================
--
-- Nobody maintains a register of documents the system does not hold. The
-- document row is now a byproduct of the first change request raised
-- against it, and the table answers what IMS actually asks: what changed
-- this year and who approved it. Four changes:
--
--   a) storage_url         where the document lives (OneDrive/SharePoint)
--   b) owner_id nullable   the company owns its procedures, not a person
--   c) can_review_document review routes to the department manager
--   d) documents INSERT    any member of the department can bring one in

-- a) The only metadata worth collecting: it turns a name into a link, and
--    it is captured at the moment someone cares.
alter table documents add column storage_url text;

-- b) The seeded owner was the IT manager, which is exactly who
--    can_review_document() resolves to with a null owner — so the current
--    flow routes the same after this as before it.
alter table documents alter column owner_id drop not null;
update documents set owner_id = null;

-- c) The workflow does not need an owner, it needs a reviewer: whose queue a
--    request lands in at the owner stage. Derived from the department by
--    default; owner_id stays as a per-document override.
create or replace function can_review_document(doc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from documents d
    where d.id = doc
      and (
        d.owner_id = auth.uid()
        or (d.owner_id is null
            and d.department_id in (select my_managed_department_ids()))
      )
  );
$$;

comment on function can_review_document(uuid) is
  'Is the caller the reviewer at the owner stage: the named owner, or the department manager when no owner is set.';

drop policy document_change_requests_select   on document_change_requests;
drop policy document_change_approvals_select  on document_change_approvals;
drop policy document_change_approvals_insert  on document_change_approvals;

create policy document_change_requests_select
  on document_change_requests for select
  to authenticated
  using (
    requester_id = auth.uid()
    or can_review_document(document_id)
    or is_ims()
  );

create policy document_change_approvals_select
  on document_change_approvals for select
  to authenticated
  using (
    exists (
      select 1 from document_change_requests r
      where r.id = document_change_approvals.request_id
        and (r.requester_id = auth.uid() or can_review_document(r.document_id) or is_ims())
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
          and can_review_document(r.document_id)
      ))
      or (stage = 'ims' and is_ims_admin())
    )
  );

drop function owns_document(uuid);

-- d) A requester brings a document into the system by raising the first
--    change against it. Creating is not editing: UPDATE stays with
--    managers and IMS admins.
drop policy documents_insert on documents;

create policy documents_insert
  on documents for insert
  to authenticated
  with check (
    is_ims_admin() or department_id in (select my_department_ids())
  );
