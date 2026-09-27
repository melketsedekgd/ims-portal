"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { getUnits } from "@/features/kpis/queries";
import { parseActual } from "@/features/kpis/parse-actual";
import { isAdmin } from "@/lib/permissions";
import type { TablesInsert } from "@/types/database";
import { getImportReview, toReviewRow, type ImportReview, type ReviewRow } from "./queries";
import { kpiIndex } from "./match";
import { normaliseName, toPercent, unitFits } from "./review";
import { reviewRowSchema, stageImportSchema, type ReviewRowInput } from "./schema";
import { loadWorkbook, MAX_FILE_BYTES, readRows } from "./sheet";
import { normaliseHeader } from "./headers";
import { IMPORT_FIELDS, importBlock, LOCKING_SIGNOFF_STATUSES } from "./types";

type Fail = { ok: false; message: string };

/** Rows per insert request. A thousand-row sheet goes in a few requests. */
const INSERT_CHUNK = 500;

const NOT_DRAFT = "This import is no longer a draft. Start a new one from the KPI list.";

/**
 * Stage a sheet: create a draft batch and one import_rows row per non-blank
 * sheet row, each matched to a KPI and its result parsed. Nothing touches
 * kpi_measurements; commit_import does that after review.
 *
 * FormData: `file`, `departmentId`, `periodId`, `sheet`, `headerRow`,
 * `columnMap` (JSON, display header names). The file is parsed again here
 * rather than trusting rows sent from the browser, so readWorkbook and this
 * read a sheet one way.
 *
 * A row's status is `ready` only when its name matches exactly one KPI of
 * the department, no other row matches that KPI, and its result reads as
 * N/A or a number whose unit suits the KPI's target. A bare number takes
 * the KPI's own unit; for a percentage KPI, `percentScale` ("fraction" or
 * "whole") says whether 0.95 is 95%. Anything else is `check` with the
 * first issue found (see ISSUE_TEXT).
 */
export async function stageImport(
  formData: FormData
): Promise<{ ok: true; review: ImportReview } | Fail> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "You must be signed in to import results." };

  let columnMap: unknown;
  try {
    columnMap = JSON.parse(String(formData.get("columnMap") ?? ""));
  } catch {
    return { ok: false, message: "The column mapping was not readable." };
  }
  const parsed = stageImportSchema.safeParse({
    departmentId: formData.get("departmentId"),
    periodId: formData.get("periodId"),
    sheet: formData.get("sheet"),
    headerRow: formData.get("headerRow"),
    percentScale: formData.get("percentScale"),
    columnMap,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid import settings" };
  }
  const input = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an Excel file to upload." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: "That file is over 7 MB." };
  }

  const supabase = await createClient();

  // The same rule the quarter picker shows, checked again here so a stale
  // page cannot stage into a quarter that will refuse the commit.
  const [{ data: period }, { data: locks }] = await Promise.all([
    supabase.from("reporting_periods").select("id, year, label, status").eq("id", input.periodId).maybeSingle(),
    supabase
      .from("quarter_signoffs")
      .select("department_id, reporting_period_id, status")
      .eq("reporting_period_id", input.periodId)
      .in("status", [...LOCKING_SIGNOFF_STATUSES]),
  ]);
  if (!period) return { ok: false, message: "That quarter does not exist." };
  const block = importBlock(
    period,
    input.departmentId,
    (locks ?? []).map((l) => ({ departmentId: l.department_id, periodId: l.reporting_period_id, status: l.status })),
    isAdmin(user)
  );
  if (block) return { ok: false, message: `${period.label} ${period.year}: ${block.label}.` };

  let sheetRows;
  try {
    const wb = await loadWorkbook(file);
    const ws = wb.getWorksheet(input.sheet);
    if (!ws) return { ok: false, message: `The workbook has no sheet named “${input.sheet}”.` };
    sheetRows = readRows(ws, input.headerRow);
  } catch {
    return { ok: false, message: "That file could not be read as an .xlsx workbook." };
  }
  const { headers, rows } = sheetRows;
  const col = (h: string | undefined) => (h ? headers.indexOf(h) : -1);
  const iName = col(input.columnMap.kpi_name);
  const iActual = col(input.columnMap.actual);
  const iRemark = col(input.columnMap.remark);
  const iEvidence = col(input.columnMap.evidence);
  if (iName < 0 || iActual < 0) {
    return { ok: false, message: "The mapped columns are not in this sheet's header row." };
  }

  const byName = await kpiIndex(input.departmentId);
  const dims = new Map((await getUnits()).map((u) => [u.key, u.dimension]));

  const staged = rows.flatMap((r) => {
    const name = r.cells[iName] ?? "";
    const actual = r.cells[iActual] ?? "";
    // A row with neither a name nor a result is a spacer or a section
    // heading, not a result to review.
    if (!name && !actual) return [];

    const matches = byName.get(normaliseName(name)) ?? [];
    const kpi = matches.length === 1 ? matches[0] : null;
    const value = parseActual(actual);

    let issue: string | null = null;
    let unit: string | null = null;
    if (matches.length === 0) issue = "no_match";
    else if (matches.length > 1) issue = "ambiguous_name";

    let amount = value.kind === "value" ? value.value : null;
    if (value.kind === "value") {
      unit = value.unit;
      if (!unit && kpi) {
        // A bare number is in the KPI's own unit. For a percentage KPI the
        // import's chosen scale says whether 0.95 means 95%.
        unit = kpi.target_unit;
        if (unit === "percent") amount = toPercent(value.value, input.percentScale);
      } else if (kpi && !unitFits(unit, kpi.target_unit, dims)) {
        issue ??= "unit_mismatch";
      }
    } else if (value.kind === "empty") issue ??= "no_value";
    else if (value.kind === "unparsed") issue ??= "unparsed_value";

    const raw = Object.fromEntries(
      headers.flatMap((h, i) => (r.cells[i] ? [[h, r.cells[i]]] : []))
    );

    return [
      {
        row_number: r.rowNumber,
        raw,
        kpi_id: kpi?.id ?? null,
        // The report's own wording is kept only when it said more than a
        // bare number — the list shows actual_text over value + unit.
        actual_text: value.kind === "value" && value.unit ? actual : null,
        actual_value: amount,
        actual_unit: value.kind === "value" ? unit : null,
        not_measured: value.kind === "not_measured",
        remark: iRemark >= 0 ? r.cells[iRemark] || null : null,
        evidence_reference: iEvidence >= 0 ? r.cells[iEvidence] || null : null,
        issue,
      },
    ];
  });

  if (staged.length === 0) {
    return { ok: false, message: "No rows below the header row have a KPI name or a result." };
  }

  // A KPI matched by more than one row: every one of them waits for the
  // reviewer to keep one. commit_import would refuse the batch otherwise.
  const perKpi = new Map<string, number>();
  for (const s of staged) if (s.kpi_id) perKpi.set(s.kpi_id, (perKpi.get(s.kpi_id) ?? 0) + 1);
  for (const s of staged) {
    if (s.kpi_id && perKpi.get(s.kpi_id)! > 1 && s.issue !== "no_match") s.issue = "duplicate_kpi";
  }

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      department_id: input.departmentId,
      reporting_period_id: input.periodId,
      file_name: file.name,
      sheet_name: input.sheet,
      header_row: input.headerRow,
    })
    .select("id")
    .single();
  if (batchError || !batch) {
    return {
      ok: false,
      message:
        batchError?.code === "42501"
          ? "You can't import results into this department."
          : (batchError?.message ?? "The import could not be started."),
    };
  }

  const inserts: TablesInsert<"import_rows">[] = staged.map((s) => ({
    ...s,
    batch_id: batch.id,
    status: s.issue ? "check" : "ready",
  }));
  for (let i = 0; i < inserts.length; i += INSERT_CHUNK) {
    const { error } = await supabase.from("import_rows").insert(inserts.slice(i, i + INSERT_CHUNK));
    if (error) {
      // Leave no half-staged draft behind. Batches are cancelled, never deleted.
      await supabase.from("import_batches").update({ status: "cancelled" }).eq("id", batch.id);
      return { ok: false, message: `The rows could not be staged: ${error.message}` };
    }
  }

  const review = await getImportReview(batch.id);
  if (!review) return { ok: false, message: "The staged import could not be read back." };
  return { ok: true, review };
}

async function unitLabeller() {
  const labels = new Map((await getUnits()).map((u) => [u.key, u.label]));
  return (key: string | null) => (key ? (labels.get(key) ?? key) : null);
}

/**
 * Confirm or correct one staged row: its KPI, result and unit. Saving is
 * the reviewer's confirmation, so a valid row becomes `ready`.
 *
 * Refused, rather than saved as `check`, when the KPI is outside the
 * batch's department, the unit cannot be scored against the KPI's target,
 * or another ready row already imports that KPI — each of which
 * commit_import would refuse for the whole batch.
 */
export async function saveImportRow(
  rowId: string,
  input: ReviewRowInput
): Promise<{ ok: true; row: ReviewRow } | Fail> {
  const parsed = reviewRowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid row" };
  }
  const r = parsed.data;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("import_rows")
    .select("batch_id, actual_text, actual_value, actual_unit, not_measured")
    .eq("id", rowId)
    .maybeSingle();
  const { data: batch } = row
    ? await supabase
        .from("import_batches")
        .select("department_id, status")
        .eq("id", row.batch_id)
        .maybeSingle()
    : { data: null };
  if (!row || batch?.status !== "draft") return { ok: false, message: NOT_DRAFT };

  const { data: kpi } = await supabase
    .from("kpis")
    .select("id, name, department_id, target_unit")
    .eq("id", r.kpiId)
    .maybeSingle();
  if (!kpi || kpi.department_id !== batch.department_id) {
    return { ok: false, message: "Pick a KPI from this import's department." };
  }

  const unit = r.notMeasured ? null : (r.actualUnit ?? kpi.target_unit);
  const dims = new Map((await getUnits()).map((u) => [u.key, u.dimension]));
  if (!unitFits(unit, kpi.target_unit, dims)) {
    return { ok: false, message: `That unit can't be scored against “${kpi.name}”'s target. Choose a matching unit.` };
  }

  const { data: other } = await supabase
    .from("import_rows")
    .select("row_number")
    .eq("batch_id", row.batch_id)
    .eq("kpi_id", r.kpiId)
    .eq("status", "ready")
    .neq("id", rowId)
    .limit(1);
  if (other?.[0]) {
    return {
      ok: false,
      message: `Row ${other[0].row_number} already imports “${kpi.name}”. Exclude one of them.`,
    };
  }

  const value = r.notMeasured ? null : r.actualValue;
  // The report's wording survives only while the figures still say the same.
  const unchanged =
    row.not_measured === r.notMeasured && row.actual_value === value && row.actual_unit === unit;

  const { data: updated, error } = await supabase
    .from("import_rows")
    .update({
      kpi_id: r.kpiId,
      actual_value: value,
      actual_unit: unit,
      not_measured: r.notMeasured,
      actual_text: unchanged && !r.notMeasured ? row.actual_text : null,
      status: "ready",
      issue: null,
    })
    .eq("id", rowId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!updated) return { ok: false, message: NOT_DRAFT };
  return { ok: true, row: toReviewRow(updated, await unitLabeller()) };
}

/** Leave one staged row out of the import. It stays in the batch as `excluded`. */
export async function excludeImportRow(
  rowId: string
): Promise<{ ok: true; row: ReviewRow } | Fail> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_rows")
    .update({ status: "excluded" })
    .eq("id", rowId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: NOT_DRAFT };
  return { ok: true, row: toReviewRow(data, await unitLabeller()) };
}

/**
 * Exclude every row still waiting for a KPI. For a sheet whose KPI column
 * also holds headings or totals, which are not results to import.
 */
export async function excludeUnmatchedRows(
  batchId: string
): Promise<{ ok: true; rowIds: string[] } | Fail> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_rows")
    .update({ status: "excluded" })
    .eq("batch_id", batchId)
    .eq("status", "check")
    .is("kpi_id", null)
    .select("id");
  if (error) return { ok: false, message: error.message };
  return { ok: true, rowIds: (data ?? []).map((r) => r.id) };
}

/**
 * Tick or untick Replace: one row, or every row of the batch when rowId is
 * null. Only read by commit_import where a result already exists; on other
 * rows it does nothing, so "Replace all" need not pick them out.
 */
export async function setReplaceExisting(
  batchId: string,
  rowId: string | null,
  replace: boolean
): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  let query = supabase
    .from("import_rows")
    .update({ replace_existing: replace })
    .eq("batch_id", batchId);
  if (rowId) query = query.eq("id", rowId);
  const { data, error } = await query.select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: NOT_DRAFT };
  return { ok: true };
}

// ── Commit ───────────────────────────────────────────────────────────────────

export type CommitCounts = { imported: number; replaced: number; skipped: number };

/**
 * commit_import's refusals, by the code each message starts with. Any of
 * them rolls the whole batch back: nothing was written.
 */
function commitMessage(error: { code?: string; message: string }): string {
  const m = error.message;
  const detail = m.slice(m.indexOf(":") + 1).trim();
  if (m.startsWith("quarter_locked")) {
    return "Not imported: this quarter has been submitted for sign-off, so its results can no longer change.";
  }
  if (m.startsWith("import_rows_unresolved")) return `Not imported: ${detail}.`;
  if (m.startsWith("import_rows_duplicate_kpi")) return `Not imported: ${detail}. Exclude one of them.`;
  if (m.startsWith("import_row_kpi_invalid")) return `Not imported: ${detail}.`;
  if (m.startsWith("measurement_not_updatable")) {
    return `Not imported: ${detail} — the period is closed to you. Untick Replace on it or ask an IMS admin.`;
  }
  if (m.startsWith("import_batch_not_draft") || m.startsWith("import_batch_not_yours")) return NOT_DRAFT;
  if (error.code === "42501") return "Not imported: this period is closed.";
  return `Not imported: ${m}`;
}

/**
 * Write a reviewed batch into kpi_measurements with commit_import, which
 * runs as the signed-in user: RLS, the quarter lock and the target snapshot
 * apply exactly as for a typed-in result, and any refusal rolls back the
 * whole batch.
 *
 * With `mapping`, the column mapping is saved first under its name for the
 * batch's department (replacing one of the same name) and linked to the
 * batch. A mapping that cannot be saved — someone else's, for a
 * contributor — does not stop the import; it comes back as a warning.
 */
export async function commitImport(
  batchId: string,
  mapping: { name: string; headers: string[]; columnMap: Record<string, string> } | null
): Promise<
  | { ok: true; counts: CommitCounts; review: ImportReview | null; warning: string | null }
  | Fail
> {
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("import_batches")
    .select("id, department_id, status")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch || batch.status !== "draft") return { ok: false, message: NOT_DRAFT };

  let warning: string | null = null;
  const name = mapping?.name.trim();
  if (mapping && name) {
    const { data: saved, error } = await supabase
      .from("import_mappings")
      .upsert(
        {
          department_id: batch.department_id,
          name,
          headers: mapping.headers.map(normaliseHeader),
          column_map: Object.fromEntries(
            Object.entries(mapping.columnMap)
              .filter(([field, header]) => (IMPORT_FIELDS as readonly string[]).includes(field) && header)
              .map(([field, header]) => [field, normaliseHeader(header)])
          ),
        },
        { onConflict: "department_id,name" }
      )
      .select("id")
      .maybeSingle();
    if (error || !saved) {
      warning = `The mapping “${name}” was not saved${error?.code === "42501" ? ": another person's mapping has that name" : ""}.`;
    } else {
      await supabase.from("import_batches").update({ mapping_id: saved.id }).eq("id", batchId);
    }
  }

  const { data, error } = await supabase.rpc("commit_import", { p_batch: batchId });
  if (error) return { ok: false, message: commitMessage(error) };

  revalidatePath("/department/kpis");
  const counts = data?.[0] ?? { imported: 0, replaced: 0, skipped: 0 };
  return { ok: true, counts, review: await getImportReview(batchId), warning };
}

/** Abandon a draft. Batches are cancelled, never deleted; the rows stay with it. */
export async function cancelImport(batchId: string): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .update({ status: "cancelled" })
    .eq("id", batchId)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: NOT_DRAFT };
  return { ok: true };
}
