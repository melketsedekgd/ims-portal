-- =============================================================
-- raise_change_request(): document and first request in one transaction
-- =============================================================
--
-- When the document does not exist yet, two PostgREST calls could leave an
-- orphan document if the second fails; one function cannot. SECURITY
-- INVOKER (the default) on purpose: the requester's own permissions are
-- what RLS checks on both inserts, and the transition guard still sees
-- their auth.uid().

create or replace function raise_change_request(
  p_document_id         uuid,     -- null when creating a new document
  p_document_name       text,
  p_department_id       uuid,
  p_document_number     text,
  p_storage_url         text,
  p_proposed_revision   text,
  p_reason              text,
  p_description         text,
  p_affected_processes  text,
  p_iso_refs            text,
  p_effective_date      date
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  doc_id uuid := p_document_id;
  req_id uuid;
begin
  if doc_id is null then
    if coalesce(btrim(p_document_name), '') = '' then
      raise exception 'A new document needs a name'
        using errcode = '23514';
    end if;
    if p_department_id is null then
      raise exception 'A new document needs a department'
        using errcode = '23514';
    end if;

    insert into documents (department_id, name, document_number, storage_url)
    values (
      p_department_id,
      btrim(p_document_name),
      nullif(btrim(p_document_number), ''),
      nullif(btrim(p_storage_url), '')
    )
    returning id into doc_id;
  end if;

  insert into document_change_requests (
    document_id,
    requester_id,
    proposed_revision,
    reason_for_change,
    description_of_change,
    affected_processes,
    related_iso_requirements,
    proposed_effective_date,
    status
  )
  values (
    doc_id,
    auth.uid(),
    btrim(p_proposed_revision),
    btrim(p_reason),
    btrim(p_description),
    nullif(btrim(p_affected_processes), ''),
    nullif(btrim(p_iso_refs), ''),
    p_effective_date,
    'pending_owner'
  )
  returning id into req_id;

  return req_id;
end;
$$;

comment on function raise_change_request(uuid, text, uuid, text, text, text, text, text, text, text, date) is
  'Raise a change request at pending_owner, creating the document first when p_document_id is null. Security invoker: RLS applies as the caller.';
