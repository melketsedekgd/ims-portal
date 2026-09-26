-- Commit a reviewed import batch into kpi_measurements.
--
-- SECURITY INVOKER on purpose: the writes run as the signed-in user, so the
-- kpi_measurements RLS, guard_quarter_lock and snapshot_measurement_target
-- apply exactly as they do to a typed-in result. Any error rolls the whole
-- commit back — a batch is committed completely or not at all.
create or replace function public.commit_import(p_batch uuid)
returns table (imported int, replaced int, skipped int)
language plpgsql
security invoker
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  v_batch       import_batches%rowtype;
  v_row         import_rows%rowtype;
  v_existing    kpi_measurements%rowtype;
  v_measurement uuid;
  v_lock        signoff_status;
  v_bad_row     int;
  v_imported    int := 0;
  v_replaced    int := 0;
  v_skipped     int := 0;
begin
  select * into v_batch from import_batches b where b.id = p_batch;
  if not found then
    raise exception 'import_batch_not_found: %', p_batch using errcode = 'P0002';
  end if;
  if v_batch.created_by is distinct from auth.uid() then
    raise exception 'import_batch_not_yours: only the creator may commit a batch'
      using errcode = '42501';
  end if;

  -- The update policy only exposes drafts, so a batch committed or cancelled
  -- in the meantime comes back as not found here.
  select * into v_batch from import_batches b where b.id = p_batch for update;
  if not found or v_batch.status <> 'draft' then
    raise exception 'import_batch_not_draft: this batch is no longer a draft'
      using errcode = '55000';
  end if;

  -- guard_quarter_lock only sees rows that are written. Rows that would be
  -- skipped are never written, and a replace in a closed period is filtered
  -- out by RLS before any trigger runs, so check the lock up front.
  select s.status into v_lock
    from quarter_signoffs s
   where s.department_id = v_batch.department_id
     and s.reporting_period_id = v_batch.reporting_period_id
     and s.status in ('submitted', 'approved', 'received');
  if v_lock is not null then
    raise exception
      'quarter_locked: this department''s quarter is % and can no longer be edited', v_lock
      using errcode = '42501';
  end if;

  select min(r.row_number) into v_bad_row
    from import_rows r
   where r.batch_id = p_batch and r.status = 'check';
  if v_bad_row is not null then
    raise exception 'import_rows_unresolved: row % still needs checking', v_bad_row
      using errcode = 'P0001';
  end if;

  select min(r.row_number) into v_bad_row
    from import_rows r
   where r.batch_id = p_batch
     and r.status = 'ready'
     and (r.kpi_id is null
          or not exists (select 1 from kpis k
                          where k.id = r.kpi_id
                            and k.department_id = v_batch.department_id));
  if v_bad_row is not null then
    raise exception 'import_row_kpi_invalid: row % has no KPI or a KPI outside this batch''s department', v_bad_row
      using errcode = '23514';
  end if;

  -- Two ready rows for one KPI would have the second silently skip or
  -- overwrite the first.
  select min(r.row_number) into v_bad_row
    from import_rows r
   where r.batch_id = p_batch
     and r.status = 'ready'
     and exists (select 1 from import_rows o
                  where o.batch_id = r.batch_id
                    and o.status = 'ready'
                    and o.kpi_id = r.kpi_id
                    and o.row_number < r.row_number);
  if v_bad_row is not null then
    raise exception 'import_rows_duplicate_kpi: row % repeats a KPI from an earlier row', v_bad_row
      using errcode = '23505';
  end if;

  perform set_config('ims.import_commit', 'on', true);

  for v_row in
    select * from import_rows r
     where r.batch_id = p_batch and r.status = 'ready'
     order by r.row_number
  loop
    select * into v_existing
      from kpi_measurements m
     where m.kpi_id = v_row.kpi_id
       and m.reporting_period_id = v_batch.reporting_period_id;

    if not found then
      -- Target and default unit are snapshotted by snapshot_measurement_target.
      insert into kpi_measurements (
        kpi_id, reporting_period_id, actual_text, actual_value, actual_unit,
        not_measured, remark, evidence_reference, recorded_by
      ) values (
        v_row.kpi_id, v_batch.reporting_period_id, v_row.actual_text,
        v_row.actual_value, v_row.actual_unit, v_row.not_measured,
        v_row.remark, v_row.evidence_reference, auth.uid()
      )
      returning id into v_measurement;

      update import_rows r
         set status = 'imported', measurement_id = v_measurement, issue = null
       where r.id = v_row.id;
      v_imported := v_imported + 1;

    elsif v_row.replace_existing then
      -- Target snapshot, recorded_by and recorded_at stay as first entered.
      -- A blank unit falls back to the target unit, as it does on insert.
      update kpi_measurements m
         set actual_text        = v_row.actual_text,
             actual_value       = v_row.actual_value,
             actual_unit        = coalesce(v_row.actual_unit, m.target_unit),
             not_measured       = v_row.not_measured,
             remark             = coalesce(v_row.remark, m.remark),
             evidence_reference = coalesce(v_row.evidence_reference, m.evidence_reference)
       where m.id = v_existing.id;
      -- RLS filters an UPDATE silently; never report a replace that didn't happen.
      if not found then
        raise exception 'measurement_not_updatable: row % cannot replace the existing result', v_row.row_number
          using errcode = '42501';
      end if;

      update import_rows r
         set status                = 'imported',
             measurement_id        = v_existing.id,
             previous_actual_text  = v_existing.actual_text,
             previous_actual_value = v_existing.actual_value,
             previous_actual_unit  = v_existing.actual_unit,
             previous_not_measured = v_existing.not_measured,
             issue                 = null
       where r.id = v_row.id;
      v_replaced := v_replaced + 1;

    else
      update import_rows r
         set status = 'skipped', issue = 'already_recorded'
       where r.id = v_row.id;
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  -- Rows first, batch last: the rows' update policy needs the batch still draft.
  update import_batches b
     set status = 'committed', committed_at = now(), committed_by = auth.uid()
   where b.id = p_batch;

  perform set_config('ims.import_commit', 'off', true);

  return query select v_imported, v_replaced, v_skipped;
end;
$$;

revoke execute on function public.commit_import(uuid) from public, anon;
grant execute on function public.commit_import(uuid) to authenticated;
