-- =============================================================
-- The lock: a submitted quarter stops being editable
-- =============================================================
--
-- A trigger rather than a change to the write policies, for three reasons.
--
-- It binds everyone. A policy does not apply to the table owner, so an
-- ims_admin, a SECURITY DEFINER function and the service role would all
-- walk through it; this stops them too. That includes migrations and seed
-- scripts, which the measurement guards deliberately wave through on a null
-- auth.uid() — here there is no such exception, and a future data fix
-- inside a submitted quarter will have to reopen it first.
--
-- It says what happened. An UPDATE that RLS refuses changes zero rows and
-- reports success, so the caller cannot tell "locked" from "no such row";
-- this raises, and the message starts 'quarter_locked:' so a caller can
-- match on it.
--
-- And it leaves the measurement policies alone. The is_ims()-in-a-write-
-- policy bug has been fixed four separate times in this schema; the
-- quarter lock is a different rule and does not belong in that expression.
create or replace function guard_quarter_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidates jsonb[] := array[]::jsonb[];
  candidate  jsonb;
  v_period   uuid;
  v_dept     uuid;
  v_status   signoff_status;
begin
  -- OLD on UPDATE and DELETE, NEW on INSERT and UPDATE. Both on an UPDATE,
  -- so a row can be neither dragged out of a locked quarter nor dropped
  -- into one.
  if tg_op in ('UPDATE', 'DELETE') then
    candidates := candidates || to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    candidates := candidates || to_jsonb(new);
  end if;

  foreach candidate in array candidates loop
    v_period := (candidate->>'reporting_period_id')::uuid;

    -- A baseline risk assessment is pre-treatment and belongs to no
    -- quarter, so no quarter can lock it. risk_assessments is the only one
    -- of these four tables where this is reachable.
    continue when v_period is null;

    v_dept := case tg_table_name
      when 'kpi_measurements' then (
        select k.department_id from kpis k
         where k.id = (candidate->>'kpi_id')::uuid)
      when 'objective_measurements' then (
        select o.department_id from objectives o
         where o.id = (candidate->>'objective_id')::uuid)
      when 'risk_assessments' then (
        select r.department_id from risks r
         where r.id = (candidate->>'risk_id')::uuid)
      when 'risk_treatment_reviews' then (
        select r.department_id
          from risk_treatments t
          join risks r on r.id = t.risk_id
         where t.id = (candidate->>'treatment_id')::uuid)
    end;

    continue when v_dept is null;

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
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function guard_quarter_lock() is
  'Refuses writes to a department''s figures once its quarter has been submitted. Binds every caller, including IMS admins, definer functions and the service role.';

create trigger kpi_measurements_quarter_lock
  before insert or update or delete on kpi_measurements
  for each row execute function guard_quarter_lock();

create trigger objective_measurements_quarter_lock
  before insert or update or delete on objective_measurements
  for each row execute function guard_quarter_lock();

create trigger risk_assessments_quarter_lock
  before insert or update or delete on risk_assessments
  for each row execute function guard_quarter_lock();

create trigger risk_treatment_reviews_quarter_lock
  before insert or update or delete on risk_treatment_reviews
  for each row execute function guard_quarter_lock();
