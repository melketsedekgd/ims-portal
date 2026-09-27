"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { getUnits } from "@/features/kpis/queries";
import { parseActual } from "@/features/kpis/parse-actual";
import { isAdmin } from "@/lib/permissions";
import type { TablesInsert } from "@/types/database";
import { getImportReview, toReviewRow, type ImportReview, type ReviewRow } from "./queries";
import { normaliseName, unitFits } from "./review";
import { reviewRowSchema, stageImportSchema, type ReviewRowInput } from "./schema";
import { loadWorkbook, MAX_FILE_BYTES, readRows } from "./sheet";
import { importBlock, LOCKING_SIGNOFF_STATUSES } from "./types";

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
 * N/A or a number whose unit suits the KPI's target. Anything else is
 * `check` with the first issue found (see ISSUE_TEXT).
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

  // DELIBERATE DEPARTMENT FILTER — the batch's department. See getImportReview.
  const { data: kpis, error: kpiError } = await supabase
    .from("kpis")
    .select("id, name, target_unit")
    .eq("department_id", input.departmentId)
    .eq("status", "active");
  if (kpiError) return { ok: false, message: kpiError.message };

  const byName = new Map<string, { id: string; target_unit: string | null }[]>();
  for (const k of kpis ?? []) {
    const key = normaliseName(k.name);
    byName.set(key, [...(byName.get(key) ?? []), k]);
  }
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

    if (value.kind === "value") {
      unit = value.unit;
      if (!unit && kpi) {
        // No unit written: the target's is assumed. Harmless for a count,
        // a guess for anything else, so those are left to confirm.
        unit = kpi.target_unit;
        if (dims.get(kpi.target_unit ?? "") !== "count") issue ??= "unit_assumed";
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
        actual_value: value.kind === "value" ? value.value : null,
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
