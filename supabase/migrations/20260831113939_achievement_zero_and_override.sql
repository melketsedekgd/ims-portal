-- =============================================================
-- Achievement: zero handling and manual override
-- =============================================================

-- A computed ratio is sometimes disputed for a legitimate reason —
-- SRD Q1 velocity scored 1 against a computed 0.65 because the
-- backlog only required 6.5 of 10 points. The override records the
-- department's figure without hiding what the system calculated,
-- and requires a written justification.
alter table kpi_measurements
  add column achievement_override numeric,
  add column override_reason      text,
  add column overridden_by        uuid references profiles(id),
  add column overridden_at        timestamptz;

alter table kpi_measurements
  add constraint override_needs_reason check (
    achievement_override is null
    or (override_reason is not null and length(trim(override_reason)) > 0)
  );

alter table kpi_measurements
  add constraint valid_override check (
    achievement_override is null
    or achievement_override between 0 and 1
  );

  -- Achievement ratio, matching the reports' "Q_ Vs AT" column.
-- Returns the override when one is set, otherwise computes:
--   higher_is_better -> min(actual / target, 1)
--   lower_is_better  -> min(target / actual, 1)
-- Both values normalise to their dimension's base unit first.
create or replace function kpi_achievement_ratio(m kpi_measurements)
returns numeric
language sql
stable
as $$
  with converted as (
    select
      m.actual_value * au.factor_to_base as actual_base,
      m.target_value * tu.factor_to_base as target_base,
      au.dimension as actual_dim,
      tu.dimension as target_dim
    from units au, units tu
    where au.key = m.actual_unit
      and tu.key = m.target_unit
  )
  select case
    when m.achievement_override is not null then m.achievement_override
    when m.not_measured then null
    when actual_base is null or target_base is null then null
    when actual_dim is distinct from target_dim then null
    when m.target_direction = 'exact'
      then case when actual_base = target_base then 1 else 0 end
    when m.target_direction = 'higher_is_better' then
      case
        when target_base = 0 then 1
        else least(actual_base / target_base, 1)
      end
    when m.target_direction = 'lower_is_better' then
      case
        when actual_base = 0 then 1
        when target_base = 0 then 0
        else least(target_base / actual_base, 1)
      end
  end
  from converted;
$$;

-- The computed value, ignoring any override. Lets the UI show both
-- side by side so IMS can see which figures are asserted.
create or replace function kpi_computed_ratio(m kpi_measurements)
returns numeric
language sql
stable
as $$
  select kpi_achievement_ratio(
    (m.id, m.kpi_id, m.reporting_period_id,
     m.actual_text, m.actual_value, m.actual_unit,
     m.target_value, m.target_unit, m.target_direction,
     m.not_measured, m.remark, m.evidence_reference,
     m.recorded_by, m.recorded_at, m.updated_at,
     null, null, null, null)::kpi_measurements
  );
$$;