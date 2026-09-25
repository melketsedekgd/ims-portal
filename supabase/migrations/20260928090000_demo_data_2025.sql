-- Demo data: a full, closed 2025.
--
-- This is an internship demo. The company does not use the app, so the live
-- database doubles as demo data. This migration adds a complete 2025 so the
-- year picker, trends, heat map and sign-off history have something to show:
--
--   * 2025 reporting periods (12 months, Q1-Q4, Annual), all closed
--   * KPI results for every active KPI, every 2025 quarter
--   * Risk scores for every risk, every 2025 quarter
--   * A separate set of 2025 objectives (objectives are yearly), with
--     activities for IT and measurements for every quarter
--   * Every 2025 quarter signed off end to end (submit, approve, receive)
--
-- Values are generated from each item's 2026 figures so 2025 reads as the
-- year before: weaker early on, improving towards the 2026 numbers.
-- Deterministic (hashtext), so re-running on a fresh database gives the
-- same numbers.
--
-- Safe to re-run: it does nothing if 2025 already exists.
-- To remove it again: supabase/scripts/wipe-demo-2025.sql

do $$
declare
  v_it        uuid := (select id from departments where code = 'IT');
  v_srd       uuid := (select id from departments where code = 'SRD');
  v_it_user   uuid := (select id from auth.users where email = 'it-contributor@ex.com');
  v_srd_user  uuid := (select id from auth.users where email = 'srd-contributor@ex.com');
  v_it_mgr    uuid := (select id from auth.users where email = 'it-dept-manager@ex.com');
  v_srd_mgr   uuid := (select id from auth.users where email = 'srd-dept-manager@ex.com');
  v_ims       uuid := (select id from auth.users where email = 'ims-admin@ex.com');
  v_q         int;
  v_pid       uuid;
  v_end       date;
begin
  if exists (select 1 from reporting_periods where year = 2025) then
    raise notice 'demo_data_2025: 2025 already exists, nothing to do';
    return;
  end if;

  ---------------------------------------------------------------------------
  -- 1. Periods
  ---------------------------------------------------------------------------
  insert into reporting_periods (year, label, type, start_date, end_date, status)
  select 2025, to_char(d, 'Mon'), 'monthly'::period_type, d,
         (d + interval '1 month' - interval '1 day')::date, 'closed'::period_status
    from generate_series(date '2025-01-01', date '2025-12-01', interval '1 month') g(d)
  union all
  select 2025, 'Q' || q, 'quarterly'::period_type, make_date(2025, q * 3 - 2, 1),
         (make_date(2025, q * 3 - 2, 1) + interval '3 months' - interval '1 day')::date, 'closed'::period_status
    from generate_series(1, 4) q
  union all
  select 2025, 'Annual', 'annual'::period_type, date '2025-01-01', date '2025-12-31', 'closed'::period_status;

  ---------------------------------------------------------------------------
  -- 2. KPI results
  ---------------------------------------------------------------------------
  -- Base value = average of the item's 2026 Q1/Q2 results in the unit its
  -- Q2 result used (Packet Loss Q1 was recorded in ms, so it is skipped).
  -- KPIs never measured in 2026 fall back to their target.
  insert into kpi_measurements
    (kpi_id, reporting_period_id, actual_value, actual_text, actual_unit,
     not_measured, remark, evidence_reference, recorded_by, recorded_at)
  with q as (
    select id as pid, substr(label, 2)::int as qn, end_date
      from reporting_periods
     where year = 2025 and type = 'quarterly'
  ),
  base as (
    select k.id as kpi_id, k.department_id, k.target_value as tv,
           k.target_direction as dir, k.measurement_frequency as f,
           coalesce(u.unit, k.target_unit) as bu,
           (select avg(m.actual_value)
              from kpi_measurements m
              join reporting_periods p on p.id = m.reporting_period_id
             where m.kpi_id = k.id and p.year = 2026 and p.label in ('Q1', 'Q2')
               and not m.not_measured and m.actual_unit = u.unit) as bv
      from kpis k
      left join lateral (
        select m.actual_unit as unit
          from kpi_measurements m
          join reporting_periods p on p.id = m.reporting_period_id
         where m.kpi_id = k.id and p.year = 2026 and p.label = 'Q2'
           and not m.not_measured
      ) u on true
     where k.status = 'active'
  ),
  gen as (
    select b.*, q.pid, q.qn, q.end_date,
           coalesce(b.bv, case when b.dir = 'higher_is_better' then b.tv else b.tv * 0.8 end) as bv0,
           (abs(hashtext(b.kpi_id::text || q.qn)) % 5) / 4.0          as j,    -- 0..1 noise
           (array[1.30, 1.20, 1.10, 1.03])[q.qn]                      as mult, -- how far behind 2026
           (array[1.00, 0.75, 0.50, 0.25])[q.qn]                      as js,   -- noise shrinks over the year
           (b.f = 'annual' and q.qn <> 4)
             or (b.f = 'semi_annual' and q.qn not in (2, 4))           as skip
      from base b cross join q
  ),
  val as (
    select g.*,
           case
             when g.skip then null
             when g.dir = 'higher_is_better' and g.bu = 'percent' then
               -- Close the gap to 100% more slowly; the second term keeps a
               -- low-scoring KPI from collapsing to 0%.
               greatest(0, least(100, greatest(
                 100 - ((100 - g.bv0) * g.mult + g.j * g.js * least(4, 100 - g.tv + 0.5)),
                 g.bv0 / g.mult - g.j * g.js * 2)))
             when g.dir = 'higher_is_better' then
               greatest(0, g.bv0 / g.mult - g.j * g.js * g.tv * 0.1)
             else
               least(case when g.bu = 'percent' then 100 else 1e9 end,
                 g.bv0 * g.mult + g.j * g.js * greatest(g.tv, 1) * 0.15)
           end as raw
      from gen g
  ),
  rounded as (
    select v.*,
           case when v.raw is null then null
                when v.bu = 'count' then round(v.raw)
                else round(v.raw, 2) end as v
      from val v
  )
  select r.kpi_id, r.pid, r.v,
         case
           when r.v is null then null
           when r.bu = 'percent'  then trim_scale(r.v)::text || '%'
           when r.bu = 'count'    then trim_scale(r.v)::text
           when r.bu = 'hr'       then trim_scale(r.v)::text || ' hr'
           when r.bu = 'day'      then trim_scale(r.v)::text || ' days'
           when r.bu = 'week'     then trim_scale(r.v)::text || ' weeks'
           when r.bu = 'story_pt' then trim_scale(r.v)::text || ' story points'
           else trim_scale(r.v)::text || ' ' || r.bu
         end,
         r.bu,
         r.skip,
         case when r.skip and r.f = 'annual'      then 'Measured annually; reported in Q4.'
              when r.skip and r.f = 'semi_annual' then 'Measured twice a year; reported in Q2 and Q4.'
         end,
         case when r.department_id = v_it
              then 'Q' || r.qn || ' 2025 IT Performance Status Report'
              else 'Q' || r.qn || ' 2025 SRD Performance Status Report' end,
         case when r.department_id = v_it then v_it_user else v_srd_user end,
         r.end_date + 5
    from rounded r;

  -- One manager override, so the override badge and reason have an example.
  update kpi_measurements m
     set achievement_override = 1,
         override_reason = 'Two of four developers were onboarding this quarter. Manager accepted the reduced velocity as on target.',
         overridden_by = v_srd_mgr,
         overridden_at = timestamptz '2025-04-08 10:00+03'
    from kpis k, reporting_periods p
   where m.kpi_id = k.id and m.reporting_period_id = p.id
     and k.department_id = v_srd and k.name = 'Average Sprint Velocity'
     and p.year = 2025 and p.label = 'Q1';

  ---------------------------------------------------------------------------
  -- 3. Risk scores
  ---------------------------------------------------------------------------
  -- Q1 2025 starts at the baseline (about half the risks one step more
  -- likely), and likelihood falls to the first 2026 score by Q4 (or one
  -- step short of it for about half).
  insert into risk_assessments
    (risk_id, reporting_period_id, type, severity, likelihood, assessed_by, assessed_at)
  with q as (
    select id as pid, substr(label, 2)::int as qn, end_date
      from reporting_periods
     where year = 2025 and type = 'quarterly'
  ),
  b as (
    select r.id, r.department_id,
           bl.severity as bs, bl.likelihood as bl,
           f.severity as s2, f.likelihood as l2,
           abs(hashtext(r.id::text)) % 2 as bump,
           abs(hashtext(r.id::text || 'end')) % 2 as lag
      from risks r
      join risk_assessments bl on bl.risk_id = r.id and bl.type = 'baseline'
      left join lateral (
        select a.severity, a.likelihood
          from risk_assessments a
          join reporting_periods p on p.id = a.reporting_period_id
         where a.risk_id = r.id and a.type = 'residual' and p.year = 2026
         order by p.start_date
         limit 1
      ) f on true
  ),
  s as (
    select b.*, q.pid, q.qn, q.end_date,
           least(5, b.bl + b.bump)                                    as l_start,
           greatest(1, least(b.bl, coalesce(b.l2, b.bl) + b.lag))     as l_end
      from b cross join q
  )
  select s.id, s.pid, 'residual'::assessment_type,
         case when s.qn = 4 then coalesce(s.s2, s.bs) else s.bs end,
         round(s.l_start + (s.l_end - s.l_start) * (s.qn - 1) / 3.0)::smallint,
         case when s.department_id = v_it then v_it_user else v_srd_user end,
         s.end_date + 7
    from s;

  ---------------------------------------------------------------------------
  -- 4. 2025 objectives
  ---------------------------------------------------------------------------
  create temp table demo_obj (
    key text primary key, dept uuid, ref smallint, title text, owner text,
    process_name text, status objective_status
  ) on commit drop;

  insert into demo_obj values
    ('it1',  v_it,  1, 'Centralize log collection for all critical servers',
     'Engineering Services Manager', 'Loging and Monitoring', 'achieved'),
    ('it2',  v_it,  2, 'Enforce multi-factor authentication for all remote access',
     'Engineering Services Manager', 'Access Control', 'achieved'),
    ('it3',  v_it,  3, 'Automate monthly patch compliance reporting',
     'Engineering Services Manager', 'Patch Management', 'retired'),
    ('srd1', v_srd, 1, 'Introduce sprint planning and milestone tracking in GitHub',
     'Associate Delivery Manager', 'Software Development', 'achieved'),
    ('srd2', v_srd, 2, 'Perform security review of HR ERP module',
     'Associate Delivery Manager', 'Software Development', 'achieved'),
    ('srd3', v_srd, 3, 'Add automated dependency scanning to the CI pipeline',
     'Associate Delivery Manager', 'Software Development', 'achieved');

  insert into objectives
    (department_id, process_id, reference_number, title, owner_title,
     start_date, target_date, status, retired_at)
  select o.dept,
         (select pr.id from processes pr
           where pr.department_id = o.dept and pr.name = o.process_name limit 1),
         o.ref, o.title, o.owner, date '2025-01-01', date '2025-12-31', o.status,
         case when o.status = 'retired' then date '2025-12-31' end
    from demo_obj o;

  -- IT activities. done_q = the quarter it was completed (null = never).
  create temp table demo_act (
    obj text, ord smallint, title text, done_q int, planned date
  ) on commit drop;

  insert into demo_act values
    ('it1', 1, 'Inventory log sources on critical servers',          1, '2025-03-31'),
    ('it1', 2, 'Configure log forwarding to the central collector',  2, '2025-06-30'),
    ('it1', 3, 'Validate 90-day retention and alerting',             3, '2025-09-30'),
    ('it2', 1, 'Enable MFA on VPN gateway',                           2, '2025-06-30'),
    ('it2', 2, 'Enable MFA on remote desktop and admin portals',      3, '2025-09-30'),
    ('it2', 3, 'Enrol all remote users and close exceptions',         4, '2025-12-15'),
    ('it3', 1, 'Define patch compliance metrics',                     1, '2025-03-31'),
    ('it3', 2, 'Export patch status from endpoint manager',           3, '2025-09-30'),
    ('it3', 3, 'Publish automated monthly compliance dashboard',   null, '2025-12-15');

  insert into objective_activities
    (objective_id, title, owner_title, planned_start_date, planned_completion_date,
     status, display_order)
  select ob.id, a.title, 'Engineering Services Manager', date '2025-01-01', a.planned,
         'not_started'::activity_status, a.ord
    from demo_act a
    join demo_obj o on o.key = a.obj
    join objectives ob on ob.department_id = o.dept and ob.title = o.title
                      and ob.start_date = date '2025-01-01';

  -- Walk the year one quarter at a time: complete that quarter's activities,
  -- then record the measurement. The measurement trigger snapshots
  -- achievement from the activities as they stand at that moment.
  for v_q in 1..4 loop
    select id, end_date into v_pid, v_end
      from reporting_periods where year = 2025 and label = 'Q' || v_q;

    update objective_activities oa
       set status = 'completed',
           completed_date = least(a.planned, v_end)
      from demo_act a
      join demo_obj o on o.key = a.obj
      join objectives ob on ob.department_id = o.dept and ob.title = o.title
                        and ob.start_date = date '2025-01-01'
     where oa.objective_id = ob.id and oa.title = a.title and a.done_q = v_q;

    update objective_activities oa
       set status = 'in_progress'
      from objectives ob
     where oa.objective_id = ob.id and ob.start_date = date '2025-01-01'
       and oa.status = 'not_started' and oa.planned_completion_date <= v_end + 92;

    insert into objective_measurements
      (objective_id, reporting_period_id, achievement, not_measured,
       evidence_reference, reason_for_deviation, followup_action,
       recorded_by, recorded_at)
    select ob.id, v_pid,
           case o.key   -- used only for SRD; IT is computed by the trigger
             when 'srd1' then (array[0.25, 0.50, 0.75, 1.00])[v_q]
             when 'srd2' then (array[null, 0.50, 1.00, 1.00])[v_q]
             when 'srd3' then (array[0.30, 0.60, 0.80, 1.00])[v_q]
           end,
           (o.key = 'srd2' and v_q = 1),
           case when o.dept = v_it then 'Q' || v_q || ' 2025 Objectives Status Report.pdf'
                when o.key = 'srd2' then 'MMCY-SRDD-F-008_Security Review_HR'
                when o.key = 'srd1' then 'Milestone progress in GitHub Projects'
                else 'CI pipeline dependency scan log' end,
           case
             when o.key = 'srd2' and v_q = 1 then 'Review scheduled to start in Q2, after the module release.'
             when o.key = 'it3'  and v_q = 2 then 'Endpoint manager licence renewal delayed the data export.'
             when o.key = 'it3'  and v_q = 4 then 'Automated dashboard not delivered by year end.'
             when o.key = 'it2'  and v_q = 1 then 'VPN vendor upgrade required before MFA could be enabled.'
           end,
           case
             when o.key = 'srd2' and v_q = 1 then 'Start the review in the first week of Q2.'
             when o.key = 'it3'  and v_q = 2 then 'Continue manual monthly reporting until the export is ready.'
             when o.key = 'it3'  and v_q = 4 then 'Carried over to 2026 under the patching objective.'
             when o.key = 'it2'  and v_q = 1 then 'Complete the VPN upgrade early in Q2.'
           end,
           case when o.dept = v_it then v_it_user else v_srd_user end,
           v_end + 5
      from demo_obj o
      join objectives ob on ob.department_id = o.dept and ob.title = o.title
                        and ob.start_date = date '2025-01-01';
  end loop;

  ---------------------------------------------------------------------------
  -- 5. Sign-offs: every 2025 quarter received, for IT and SRD
  ---------------------------------------------------------------------------
  -- Inserted last: a received quarter locks its data.
  create temp table demo_so (id uuid, dept uuid, mgr uuid, t date) on commit drop;

  with ins as (
    insert into quarter_signoffs
      (department_id, reporting_period_id, status,
       submitted_by, submitted_at, approved_by, approved_at,
       received_by, received_at, created_at)
    select d.id, p.id, 'received'::signoff_status,
           d.mgr, p.end_date + 10, d.mgr, p.end_date + 12,
           v_ims, p.end_date + 15, p.end_date + 10
      from (values (v_it, v_it_mgr), (v_srd, v_srd_mgr)) d(id, mgr)
      cross join reporting_periods p
     where p.year = 2025 and p.type = 'quarterly'
    returning id, department_id, submitted_by, submitted_at::date
  )
  insert into demo_so select * from ins;

  insert into quarter_signoff_decisions (signoff_id, decision, decided_by, created_at)
  select s.id, 'submit'::signoff_decision,  s.mgr, s.t      from demo_so s
  union all
  select s.id, 'approve'::signoff_decision, s.mgr, s.t + 2  from demo_so s
  union all
  select s.id, 'receive'::signoff_decision, v_ims, s.t + 5  from demo_so s;

  -- The sign-off trigger notifies people; old 2025 history shouldn't ring
  -- anyone's bell today.
  delete from notifications where subject_id in (select id from demo_so);
end $$;
