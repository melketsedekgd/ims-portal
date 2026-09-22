-- =============================================================
-- risk_treatment_reviews: closed periods become read-only
-- =============================================================
--
-- The other three per-period tables gained this condition on 11 and 14
-- September; risk_treatment_reviews was missed. Measured before this
-- migration: a department_contributor updated a review belonging to Q1 —
-- closed since the Q1 report was signed — and changed 1 row. The same
-- update against risk_assessments and kpi_measurements changed 0 rows,
-- which is what the condition is supposed to do.
--
-- The expression is copied verbatim from risk_assessments so the two read
-- identically. Its "reporting_period_id is null" branch is unreachable here
-- (the column is NOT NULL on this table) and is kept only so a reader
-- comparing the two policies sees the same text, not a near-miss.
--
-- is_ims_admin(), never is_ims(): a reviewer reads. Altered in place rather
-- than dropped and recreated, so the department half keeps working
-- throughout.

alter policy risk_treatment_reviews_insert on risk_treatment_reviews
  with check (
    exists (
      select 1
      from risk_treatments t
      join risks r on r.id = t.risk_id
      where t.id = risk_treatment_reviews.treatment_id
        and (is_ims_admin() or r.department_id in (select my_department_ids()))
    )
    and (
      risk_treatment_reviews.reporting_period_id is null
      or exists (
        select 1 from reporting_periods p
        where p.id = risk_treatment_reviews.reporting_period_id
          and (p.status = 'open' or is_ims_admin())
      )
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
    and (
      risk_treatment_reviews.reporting_period_id is null
      or exists (
        select 1 from reporting_periods p
        where p.id = risk_treatment_reviews.reporting_period_id
          and (p.status = 'open' or is_ims_admin())
      )
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
    and (
      risk_treatment_reviews.reporting_period_id is null
      or exists (
        select 1 from reporting_periods p
        where p.id = risk_treatment_reviews.reporting_period_id
          and (p.status = 'open' or is_ims_admin())
      )
    )
  );
