-- =============================================================
-- record_risk_review(): the quarter's residual score and treatment review
-- in one transaction
-- =============================================================
--
-- Quarterly entry is one judgement: is the treatment working, and how risky
-- is the risk now? Saving the two separately leaves quarters with a score
-- but no review, so the register's dialog saves both through this function
-- or neither.
--
-- One review per treatment per quarter. The table has enforced that since
-- it was created, through the unique index risk_treatment_reviews_period_idx;
-- this promotes that index to a named constraint rather than building a
-- second one over the same columns. Checked before this migration: no
-- duplicate (treatment_id, reporting_period_id) pairs.
--
-- SECURITY INVOKER: risk_assessments_insert/_update and
-- risk_treatment_reviews_insert/_update apply as the caller (department
-- members and IMS admins; closed periods refused), and guard_quarter_lock()
-- refuses a signed-off quarter on both tables. Neither is re-checked here;
-- they raise their own 42501.
--
-- The residual upsert matches what saveRiskAssessment did from the client:
-- conflict on (risk_id, reporting_period_id), type 'residual', rpn left to
-- its generated column. A null period is refused first — the unique
-- constraint is NULLS NOT DISTINCT, so a null would land on the risk's
-- baseline and overwrite it.
--
-- A risk "has a treatment" when any of its treatments is not cancelled. The
-- register offers the current one (newest planned/in progress, else newest
-- completed); this function accepts any non-cancelled treatment of the
-- risk. Read as the caller, so a treatment they cannot see reads as absent.
--
-- Text is trimmed and empty text stored as NULL. Every refusal of the
-- function's own is 23514 with a sentence that can go to the user as is.

alter table risk_treatment_reviews
  add constraint risk_treatment_reviews_treatment_period_key
  unique using index risk_treatment_reviews_period_idx;

create function record_risk_review(
  p_risk_id            uuid,
  p_period_id          uuid,
  p_severity           smallint,
  p_likelihood         smallint,
  p_notes              text,
  p_treatment_id       uuid,                     -- null when the risk has no treatment
  p_effectiveness      treatment_effectiveness,  -- null when the risk has no treatment
  p_solution_evidence  text,
  p_reason             text,                     -- required unless 'maintain'
  p_followup           text                      -- required unless 'maintain'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_has_treatment    boolean;
  v_treatment_status treatment_status;
  v_reason           text := nullif(btrim(p_reason), '');
  v_followup         text := nullif(btrim(p_followup), '');
begin
  if p_risk_id is null then
    raise exception 'A review needs a risk'
      using errcode = '23514';
  end if;

  if p_period_id is null then
    raise exception 'A review needs a reporting period'
      using errcode = '23514';
  end if;

  if p_severity is null or p_severity not between 1 and 5 then
    raise exception 'Severity must be between 1 and 5, got %', coalesce(p_severity::text, 'null')
      using errcode = '23514';
  end if;

  if p_likelihood is null or p_likelihood not between 1 and 5 then
    raise exception 'Likelihood must be between 1 and 5, got %', coalesce(p_likelihood::text, 'null')
      using errcode = '23514';
  end if;

  select exists (
    select 1
    from risk_treatments
    where risk_id = p_risk_id
      and status <> 'cancelled'
  )
  into v_has_treatment;

  if v_has_treatment then
    if p_treatment_id is null then
      raise exception 'This risk has a treatment, so the review must say which one it is about'
        using errcode = '23514';
    end if;

    select status
    into v_treatment_status
    from risk_treatments
    where id = p_treatment_id
      and risk_id = p_risk_id;

    if not found then
      raise exception 'The treatment being reviewed does not belong to this risk'
        using errcode = '23514';
    end if;

    if v_treatment_status = 'cancelled' then
      raise exception 'A cancelled treatment cannot be reviewed'
        using errcode = '23514';
    end if;

    if p_effectiveness is null then
      raise exception 'Choose whether the treatment is working'
        using errcode = '23514';
    end if;

    if p_effectiveness <> 'maintain' and (v_reason is null or v_followup is null) then
      raise exception 'A treatment that needs a correction or corrective action needs a reason for deviation and a follow-up measure'
        using errcode = '23514';
    end if;
  elsif p_treatment_id is not null or p_effectiveness is not null then
    raise exception 'This risk has no treatment to review'
      using errcode = '23514';
  end if;

  insert into risk_assessments (
    risk_id,
    reporting_period_id,
    type,
    severity,
    likelihood,
    notes,
    assessed_by,
    assessed_at
  )
  values (
    p_risk_id,
    p_period_id,
    'residual'::assessment_type,
    p_severity,
    p_likelihood,
    nullif(btrim(p_notes), ''),
    auth.uid(),
    now()
  )
  on conflict (risk_id, reporting_period_id) do update
    set type        = excluded.type,
        severity    = excluded.severity,
        likelihood  = excluded.likelihood,
        notes       = excluded.notes,
        assessed_by = excluded.assessed_by,
        assessed_at = excluded.assessed_at;

  if v_has_treatment then
    insert into risk_treatment_reviews (
      treatment_id,
      reporting_period_id,
      effectiveness,
      solution_evidence,
      reason_for_deviation,
      followup_measure,
      reviewed_by,
      reviewed_at
    )
    values (
      p_treatment_id,
      p_period_id,
      p_effectiveness,
      nullif(btrim(p_solution_evidence), ''),
      v_reason,
      v_followup,
      auth.uid(),
      now()
    )
    on conflict (treatment_id, reporting_period_id) do update
      set effectiveness        = excluded.effectiveness,
          solution_evidence    = excluded.solution_evidence,
          reason_for_deviation = excluded.reason_for_deviation,
          followup_measure     = excluded.followup_measure,
          reviewed_by          = excluded.reviewed_by,
          reviewed_at          = excluded.reviewed_at;
  end if;
end;
$$;

comment on function record_risk_review(uuid, uuid, smallint, smallint, text, uuid, treatment_effectiveness, text, text, text) is
  'Save a risk''s residual score for a period and, when it has a treatment, that treatment''s review for the same period, atomically. Security invoker: RLS and the quarter lock apply as the caller.';

revoke execute on function record_risk_review(uuid, uuid, smallint, smallint, text, uuid, treatment_effectiveness, text, text, text) from public, anon;
grant execute on function record_risk_review(uuid, uuid, smallint, smallint, text, uuid, treatment_effectiveness, text, text, text) to authenticated;
