update kpi_measurements m
set achievement_override = 1.0,
    override_reason = 'Target of 10 story points is a capacity ceiling, not a delivery goal. Q1 backlog required 6.5 points and 100% of prioritized stories were delivered. Full achievement per the Q1 SRD performance report.'
from kpis k, departments d, reporting_periods p
where m.kpi_id = k.id
  and k.department_id = d.id
  and m.reporting_period_id = p.id
  and d.code = 'SRD'
  and k.name = 'Average Sprint Velocity'
  and p.year = 2026
  and p.label = 'Q1';