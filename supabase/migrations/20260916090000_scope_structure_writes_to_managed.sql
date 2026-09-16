-- =============================================================
-- Scope department and process writes to managed departments
-- =============================================================
--
-- departments_update, processes_insert and processes_update tested "holds
-- department_manager anywhere" AND "department is one I belong to" as two
-- separate conditions. A manager of IT holding any role in SRD satisfied
-- both halves for SRD. The admin pages make that reachable through the UI,
-- so the two halves become one: the department must be one the caller
-- manages. my_managed_department_ids() is the write helper for exactly
-- this; my_department_ids() is for reads.
--
-- No other schema change. Deactivation is handled by removing role rows,
-- not by a status check in the helpers.

drop policy departments_update on departments;
create policy departments_update
  on departments for update
  to authenticated
  using (
    is_ims_admin() or id in (select my_managed_department_ids())
  )
  with check (
    is_ims_admin() or id in (select my_managed_department_ids())
  );

drop policy processes_insert on processes;
create policy processes_insert
  on processes for insert
  to authenticated
  with check (
    is_ims_admin() or department_id in (select my_managed_department_ids())
  );

drop policy processes_update on processes;
create policy processes_update
  on processes for update
  to authenticated
  using (
    is_ims_admin() or department_id in (select my_managed_department_ids())
  )
  with check (
    is_ims_admin() or department_id in (select my_managed_department_ids())
  );
