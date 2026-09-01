-- Two active KPIs with the same name in the same process is always
-- a mistake — either a double-submitted form or a duplicated import.
-- Scoped to active so a retired KPI's name can be reused later.
create unique index kpis_name_active_idx
  on kpis (
    department_id,
    coalesce(process_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  )
  where status = 'active';