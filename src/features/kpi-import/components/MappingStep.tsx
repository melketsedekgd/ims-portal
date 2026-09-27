"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import Choice from "./Choice"
import { FIELD_LABEL, IMPORT_FIELDS, type ImportField } from "../types"
import type { WorkbookRead } from "../parse"

/** Field → display header name; "" when the field is not in this sheet. */
export type DraftMap = Record<ImportField, string>

const NONE = "__none__"
const REQUIRED: readonly ImportField[] = ["kpi_name", "actual"]

/** Step 3: which column holds each field. */
export default function MappingStep({
  read,
  map,
  source,
  pending,
  onChange,
  onBack,
  onContinue,
}: {
  read: WorkbookRead
  map: DraftMap
  /** Where the current map came from, said above the fields. */
  source: { kind: "saved"; name: string } | { kind: "suggested" }
  pending: boolean
  onChange: (map: DraftMap) => void
  onBack: () => void
  onContinue: () => void
}) {
  const chosen = IMPORT_FIELDS.map((f) => map[f]).filter(Boolean)
  const clash = new Set(chosen).size !== chosen.length
  const missing = REQUIRED.filter((f) => !map[f])
  const index = (header: string) => read.headers.indexOf(header)

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {source.kind === "saved"
          ? `These headers match the saved mapping “${source.name}”, so it has been applied.`
          : "Suggested from the header names. Check each one."}{" "}
        Only the KPI name and the result are required.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {IMPORT_FIELDS.map((field) => {
          const required = REQUIRED.includes(field)
          return (
            <div key={field} className="space-y-2">
              <Label htmlFor={`map-${field}`}>
                {FIELD_LABEL[field]} {required && <span className="text-rose-500">*</span>}
              </Label>
              <Choice
                id={`map-${field}`}
                value={map[field] || NONE}
                onChange={(v) => onChange({ ...map, [field]: v === NONE ? "" : v })}
                items={[
                  ...(required ? [] : [{ value: NONE, label: "— Not in this sheet —" }]),
                  ...read.headers.map((h) => ({ value: h, label: h })),
                ]}
                placeholder="Choose a column"
                disabled={pending}
              />
            </div>
          )
        })}
      </div>

      {clash && (
        <p className="text-sm text-rose-700">Each column can be used for one field only.</p>
      )}

      <div className="rounded-lg border overflow-auto bg-white dark:bg-slate-950">
        <table className="text-sm w-full">
          <thead className="bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground">
            <tr>
              {IMPORT_FIELDS.map((f) => (
                <th key={f} className="text-left font-medium px-3 py-2">
                  {FIELD_LABEL[f]}
                  {map[f] && <span className="font-normal"> · {map[f]}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {read.sample.map((row, i) => (
              <tr key={i} className="border-t">
                {IMPORT_FIELDS.map((f) => (
                  <td key={f} className="px-3 py-2 max-w-[280px] truncate" title={map[f] ? row[index(map[f])] : ""}>
                    {map[f] ? row[index(map[f])] || "—" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 py-2 text-xs text-muted-foreground border-t">
          First {read.sample.length} of {read.dataRowCount} rows.
        </p>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={pending}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={pending || clash || missing.length > 0}>
          {pending ? "Matching rows…" : `Review ${read.dataRowCount} rows`}
        </Button>
      </div>
    </div>
  )
}
