-- =============================================================
-- Actions always belong to something
-- =============================================================
--
-- In the IMS reports every follow-up belongs to a row — an objective or a
-- risk in a quarter. An action with no source has no reason to exist and
-- cannot be verified, so the standalone 'other' action is retired.
--
-- Checked before adding the constraint: no function or insert in
-- supabase/migrations writes actions with source_type 'other' or a null
-- source_id. The only inserts are the follow-up backfills in
-- 20260920160000, which always carry the measurement/review id. The one
-- writer of 'other' was the app's standalone "New action" dialog, changed
-- in the same branch as this migration.
--
-- The enum value 'other' is not dropped: evidence.linked_type shares
-- action_source, and Postgres cannot drop an enum value in place anyway.
-- source_id_iff_not_other stays; it is implied by this one and harmless.

alter table public.actions
  add constraint actions_source_required
  check (source_id is not null and source_type <> 'other');


-- =============================================================
-- v_action_sources — what each action belongs to
-- =============================================================
--
-- One row per action, resolving the polymorphic (source_type, source_id)
-- pointer to the item a person recognises: the risk, KPI, objective or
-- document change request, plus the quarter when the source is a
-- quarterly row (a treatment review or a measurement).
--
--   item_type    'risk' | 'kpi' | 'objective' | 'document'; null only for
--                an action pointing at another action
--   item_id      the risk / kpi / objective / document_change_request id
--   document_id  the change request's document, for the link — change
--                requests have no page of their own, they are listed on
--                their document's page
--   reporting_period_id / period_year / period_label
--                null when the source is not tied to a period
--   context_reason / context_followup
--                the report's own text, exactly as stored
--
-- Every join is a LEFT JOIN on purpose: a source id that no longer
-- resolves still shows its action, with a null label, instead of making
-- it disappear from the list.
--
-- security_invoker = true: the view reads actions and every source table
-- as the signed-in user, so RLS decides which rows come back. Without it
-- the view would run as its owner and show every department's actions.
--
-- department_id is the action's own. The source guard trigger
-- (guard_action_source_department) keeps it equal to the source's.

create view public.v_action_sources
  with (security_invoker = true)
as
select
  a.id as action_id,
  case a.source_type
    when 'risk'                  then 'risk'
    when 'risk_treatment'        then 'risk'
    when 'risk_treatment_review' then 'risk'
    when 'kpi'                   then 'kpi'
    when 'kpi_measurement'       then 'kpi'
    when 'objective'             then 'objective'
    when 'objective_measurement' then 'objective'
    when 'document_change'       then 'document'
  end as item_type,
  coalesce(r.id, k.id, o.id, cr.id) as item_id,
  case
    when r.id is not null then coalesce(r.risk_statement, r.threat, r.affected_assets)
    when k.id is not null then k.name
    when o.id is not null then o.title
    when cr.id is not null then d.name
  end as item_label,
  d.id as document_id,
  a.department_id,
  rp.id as reporting_period_id,
  rp.year as period_year,
  rp.label as period_label,
  case a.source_type
    when 'risk_treatment_review' then rtr.reason_for_deviation
    when 'kpi_measurement'       then km.remark
    when 'objective_measurement' then om.reason_for_deviation
  end as context_reason,
  case a.source_type
    when 'risk_treatment_review' then rtr.followup_measure
    when 'objective_measurement' then om.followup_action
  end as context_followup
from public.actions a

-- risk ← risk_treatment ← risk_treatment_review
left join public.risk_treatment_reviews rtr
  on a.source_type = 'risk_treatment_review'
 and rtr.id = a.source_id
left join public.risk_treatments rt
  on rt.id = case a.source_type
               when 'risk_treatment'        then a.source_id
               when 'risk_treatment_review' then rtr.treatment_id
             end
left join public.risks r
  on r.id = case a.source_type
              when 'risk'                  then a.source_id
              when 'risk_treatment'        then rt.risk_id
              when 'risk_treatment_review' then rt.risk_id
            end

-- kpi ← kpi_measurement
left join public.kpi_measurements km
  on a.source_type = 'kpi_measurement'
 and km.id = a.source_id
left join public.kpis k
  on k.id = case a.source_type
              when 'kpi'             then a.source_id
              when 'kpi_measurement' then km.kpi_id
            end

-- objective ← objective_measurement
left join public.objective_measurements om
  on a.source_type = 'objective_measurement'
 and om.id = a.source_id
left join public.objectives o
  on o.id = case a.source_type
              when 'objective'             then a.source_id
              when 'objective_measurement' then om.objective_id
            end

-- document ← document_change_request
left join public.document_change_requests cr
  on a.source_type = 'document_change'
 and cr.id = a.source_id
left join public.documents d
  on d.id = cr.document_id

-- the quarter, from whichever quarterly row the action points at
left join public.reporting_periods rp
  on rp.id = coalesce(rtr.reporting_period_id, km.reporting_period_id, om.reporting_period_id);

revoke all on public.v_action_sources from anon, authenticated;
grant select on public.v_action_sources to authenticated;
