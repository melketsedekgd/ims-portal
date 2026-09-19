-- =============================================================
-- Evidence writes open to department members
-- =============================================================
--
-- Evidence is a record of what was measured, not a definition — the
-- same class of thing as a KPI measurement or an objective measurement,
-- both of which any department member can write. Actions stay
-- manager-only; they're assigned, not self-recorded. Altered in place,
-- never dropped, so existing role grants survive.
--
-- This inherits the same department-scoped-viewer gap that already
-- exists on measurements (a contributor's my_department_ids() doesn't
-- distinguish them from a manager). Not new here, not in scope here.

alter policy evidence_insert on evidence
  with check (
    is_ims_admin()
    or department_id in (select my_department_ids())
  );

alter policy evidence_update on evidence
  using (
    is_ims_admin()
    or department_id in (select my_department_ids())
  )
  with check (
    is_ims_admin()
    or department_id in (select my_department_ids())
  );


-- =============================================================
-- action_source: add 'action'
-- =============================================================
--
-- Evidence can now attach directly to an action (e.g. proof of
-- completion), not just to the record an action originated from. A new
-- enum value can't be used in the same transaction that adds it, so
-- this is its own statement with nothing after it in this migration
-- that references 'action'.

alter type action_source add value 'action';


-- =============================================================
-- department_of(): resolve 'action'
-- =============================================================
--
-- Without this, evidence.linked_type = 'action' resolves to null in
-- department_of() and falls into "nothing to check" in
-- guard_evidence_linked_department() — silently skipping the department
-- match for the exact case this enum value exists to support. p_type is
-- text, not action_source, so this function never casts to the enum and
-- isn't subject to the same-transaction restriction above; it's ordered
-- after the ALTER TYPE here only to read top-to-bottom as one change.

create or replace function department_of(p_type text, p_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result uuid;
begin
  if p_id is null then
    return null;
  end if;

  case p_type
    when 'risk' then
      select r.department_id into result
      from risks r
      where r.id = p_id;

    when 'risk_treatment' then
      select r.department_id into result
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = p_id;

    when 'risk_treatment_review' then
      select r.department_id into result
      from risk_treatment_reviews v
      join risk_treatments t on t.id = v.treatment_id
      join risks r on r.id = t.risk_id
      where v.id = p_id;

    when 'kpi' then
      select k.department_id into result
      from kpis k
      where k.id = p_id;

    when 'kpi_measurement' then
      select k.department_id into result
      from kpi_measurements m
      join kpis k on k.id = m.kpi_id
      where m.id = p_id;

    when 'objective' then
      select o.department_id into result
      from objectives o
      where o.id = p_id;

    when 'objective_measurement' then
      select o.department_id into result
      from objective_measurements m
      join objectives o on o.id = m.objective_id
      where m.id = p_id;

    when 'document_change' then
      select d.department_id into result
      from document_change_requests cr
      join documents d on d.id = cr.document_id
      where cr.id = p_id;

    when 'action' then
      select a.department_id into result
      from actions a
      where a.id = p_id;

    else
      result := null;
  end case;

  return result;
end;
$$;
