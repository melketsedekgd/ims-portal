-- =============================================================
-- Owner-stage fallback for departments with no manager
-- =============================================================
--
-- SRD has no department_manager, so under the department rule an SRD
-- request sits at pending_owner with nobody able to decide it. An IMS
-- admin may now review the owner stage — but only where the department
-- has no manager. A blanket is_ims_admin() would let IMS approve the owner
-- stage on IT documents too, turning a two-stage review into one person
-- deciding twice.

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
        or (d.owner_id is null
            and is_ims_admin()
            and not exists (
              select 1
              from user_roles ur
              join roles r on r.id = ur.role_id
              where r.key = 'department_manager'
                and ur.department_id = d.department_id))
      )
  );
$$;

comment on function can_review_document(uuid) is
  'Is the caller the reviewer at the owner stage: the named owner; the department manager when no owner is set; or an IMS admin when the department has no manager at all.';
