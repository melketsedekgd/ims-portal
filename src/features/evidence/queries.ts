import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type Evidence = {
  id: string;
  departmentId: string;
  linkedType: Enums<"action_source">;
  linkedId: string;
  name: string;
  type: Enums<"evidence_type">;
  location: string | null;
  /** 'app' for anything added through the UI, 'backfill' for migrated rows. */
  source: string;
  uploadedBy: string | null;
  uploadedAt: string;
};

type EvidenceRow = {
  id: string;
  department_id: string;
  linked_type: Enums<"action_source">;
  linked_id: string;
  name: string;
  type: Enums<"evidence_type">;
  location: string | null;
  source: string;
  uploaded_by: string | null;
  uploaded_at: string;
};

function toEvidence(r: EvidenceRow): Evidence {
  return {
    id: r.id,
    departmentId: r.department_id,
    linkedType: r.linked_type,
    linkedId: r.linked_id,
    name: r.name,
    type: r.type,
    location: r.location,
    source: r.source,
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
  };
}

/**
 * Evidence attached to one record — a risk, a KPI measurement, an
 * objective, an action, etc. Additive alongside that record's own
 * free-text evidence column, which this does not read or replace.
 */
export async function getEvidenceFor(
  linkedType: Enums<"action_source">,
  linkedId: string
): Promise<Evidence[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evidence")
    .select(
      "id, department_id, linked_type, linked_id, name, type, location, source, uploaded_by, uploaded_at"
    )
    .eq("linked_type", linkedType)
    .eq("linked_id", linkedId)
    .order("uploaded_at", { ascending: false })
    .returns<EvidenceRow[]>();

  if (error) throw error;
  return (data ?? []).map(toEvidence);
}
