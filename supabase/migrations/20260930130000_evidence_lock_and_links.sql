-- =============================================================
-- Evidence follows its quarter's lock
-- =============================================================
--
-- A received quarter is the record IMS accepted, and the evidence behind
-- its figures is part of that record. Until now the measurements were
-- locked and the evidence attached to them was not: anyone who could write
-- evidence could add to, rename or delete it after sign-off.
--
-- Same two rules the measurements have, applied the same way:
--
--   sign-off lock  a quarter_signoffs row in submitted/approved/received
--                  refuses the write for every caller, service role and
--                  migrations included. Same query, same 'quarter_locked:'
--                  text and errcode as guard_quarter_lock(), so the callers
--                  that already match on it need nothing new.
--
--   closed period  reporting_periods.status = 'closed' refuses a signed-in
--                  caller who is not an IMS admin. On the measurements this
--                  lives in the write policies; here it is in the trigger,
--                  because the evidence policies scope by department and
--                  know nothing of periods, and a trigger can say why it
--                  refused where a policy only returns zero rows. A null
--                  auth.uid() (scripts, migrations) passes, as it does for
--                  the measurement guards.
--
-- Only evidence on a quarterly record has a quarter: kpi_measurement,
-- objective_measurement and risk_treatment_review. Evidence on a risk, a
-- treatment, a KPI definition or an action belongs to no period and is
-- not touched.
create or replace function guard_evidence_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidates jsonb[] := array[]::jsonb[];
  candidate  jsonb;
  v_id       uuid;
  v_period   uuid;
  v_dept     uuid;
  v_status   signoff_status;
begin
  -- OLD on UPDATE and DELETE, NEW on INSERT and UPDATE. Both on an UPDATE,
  -- so evidence can be neither moved off a locked record nor onto one.
  if tg_op in ('UPDATE', 'DELETE') then
    candidates := candidates || to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    candidates := candidates || to_jsonb(new);
  end if;

  foreach candidate in array candidates loop
    v_id := (candidate->>'linked_id')::uuid;
    v_period := null;
    v_dept := null;

    case candidate->>'linked_type'
      when 'kpi_measurement' then
        select m.reporting_period_id, k.department_id
          into v_period, v_dept
          from kpi_measurements m
          join kpis k on k.id = m.kpi_id
         where m.id = v_id;

      when 'objective_measurement' then
        select m.reporting_period_id, o.department_id
          into v_period, v_dept
          from objective_measurements m
          join objectives o on o.id = m.objective_id
         where m.id = v_id;

      when 'risk_treatment_review' then
        select v.reporting_period_id, r.department_id
          into v_period, v_dept
          from risk_treatment_reviews v
          join risk_treatments t on t.id = v.treatment_id
          join risks r on r.id = t.risk_id
         where v.id = v_id;

      else
        -- Not quarterly: no period, nothing to lock.
        continue;
    end case;

    continue when v_period is null or v_dept is null;

    select s.status into v_status
      from quarter_signoffs s
     where s.department_id = v_dept
       and s.reporting_period_id = v_period
       and s.status in ('submitted', 'approved', 'received');

    if v_status is not null then
      raise exception
        'quarter_locked: this department''s quarter is % and can no longer be edited', v_status
        using errcode = '42501';
    end if;

    if auth.uid() is not null
       and not is_ims_admin()
       and exists (
         select 1 from reporting_periods p
          where p.id = v_period
            and p.status = 'closed'
       ) then
      raise exception 'period_closed: this quarter is closed'
        using errcode = '42501';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function guard_evidence_lock() is
  'Refuses writes to evidence on a quarterly record once its quarter is signed off (everyone) or closed (everyone but IMS admins and null-uid scripts). Mirrors guard_quarter_lock().';

create trigger evidence_quarter_lock
  before insert or update or delete on evidence
  for each row execute function guard_evidence_lock();


-- =============================================================
-- A link is an http(s) URL
-- =============================================================
--
-- The page renders a link's location as an <a href>. Anything else there
-- (javascript:, data:, a bare hostname) is either broken or dangerous.
-- A null location passes: the check is null, not false.
alter table evidence
  add constraint evidence_link_is_url
  check (type <> 'link' or location ~* '^https?://[^\s]+$');
