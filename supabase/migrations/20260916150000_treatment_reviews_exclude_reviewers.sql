-- =============================================================
-- risk_treatment_reviews: writes exclude ims_reviewer
-- =============================================================
--
-- Both write policies used is_ims(), which includes ims_reviewer — a
-- reviewer writing what they review contradicts the documented model
-- (ims_reviewer: read only, deliberately excluded from writes). These were
-- the last two write policies anywhere still calling is_ims(); the
-- definition, measurement and treatment policies had already moved to
-- is_ims_admin() on 2 September, 11 September and 16 September.
--
-- The department half of each expression is unchanged: a contributor
-- recording a review for their own department is correct and keeps
-- working. Altered in place, never dropped.

alter policy risk_treatment_reviews_insert on risk_treatment_reviews
  with check (
    exists (
      select 1
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = risk_treatment_reviews.treatment_id
        and (is_ims_admin() or r.department_id in (select my_department_ids()))
    )
  );

alter policy risk_treatment_reviews_update on risk_treatment_reviews
  using (
    exists (
      select 1
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = risk_treatment_reviews.treatment_id
        and (is_ims_admin() or r.department_id in (select my_department_ids()))
    )
  )
  with check (
    exists (
      select 1
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = risk_treatment_reviews.treatment_id
        and (is_ims_admin() or r.department_id in (select my_department_ids()))
    )
  );
