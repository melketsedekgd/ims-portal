-- =============================================================
-- risk_treatments: writes are a manager's
-- =============================================================
--
-- A treatment is the plan for a risk, not a result against it — the same
-- class of thing as a KPI or objective definition, which only a department
-- manager or an IMS admin may write. Reads stay department-wide.
--
-- risk_treatment_reviews is deliberately untouched: a review IS the
-- period's result, and a contributor records those.

alter policy risk_treatments_insert on risk_treatments
  with check (
    exists (
      select 1 from risks r
      where r.id = risk_treatments.risk_id
        and (is_ims_admin() or r.department_id in (select my_managed_department_ids()))
    )
  );

alter policy risk_treatments_update on risk_treatments
  using (
    exists (
      select 1 from risks r
      where r.id = risk_treatments.risk_id
        and (is_ims_admin() or r.department_id in (select my_managed_department_ids()))
    )
  )
  with check (
    exists (
      select 1 from risks r
      where r.id = risk_treatments.risk_id
        and (is_ims_admin() or r.department_id in (select my_managed_department_ids()))
    )
  );
