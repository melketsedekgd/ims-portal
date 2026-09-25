-- Removes everything added by 20260928090000_demo_data_2025.sql.
-- Run in the SQL Editor (as postgres). One transaction: all or nothing.
-- Sign-offs go first, because a received quarter locks its data.
begin;

delete from notifications
 where subject_id in (select s.id from quarter_signoffs s
                        join reporting_periods p on p.id = s.reporting_period_id
                       where p.year = 2025);

delete from quarter_signoff_decisions
 where signoff_id in (select s.id from quarter_signoffs s
                        join reporting_periods p on p.id = s.reporting_period_id
                       where p.year = 2025);

delete from quarter_signoffs
 where reporting_period_id in (select id from reporting_periods where year = 2025);

delete from kpi_measurements
 where reporting_period_id in (select id from reporting_periods where year = 2025);

delete from risk_assessments
 where reporting_period_id in (select id from reporting_periods where year = 2025);

delete from objective_measurements
 where reporting_period_id in (select id from reporting_periods where year = 2025);

delete from objective_activities
 where objective_id in (select id from objectives
                         where start_date = date '2025-01-01' and target_date = date '2025-12-31');

delete from objectives
 where start_date = date '2025-01-01' and target_date = date '2025-12-31';

delete from reporting_periods where year = 2025;

commit;
