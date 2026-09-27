"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import Choice from "./Choice"
import { FIELD_LABEL, IMPORT_FIELDS, type ImportField } from "../types"
import type { PercentScaleGuess, WorkbookRead } from "../parse"
import type { PercentScale } from "../review"

/** Field → display header name; "" when the field is not in this sheet. */
export type DraftMap = Record<ImportField, string>

const NONE = "__none__"
const REQUIRED: readonly ImportField[] = ["kpi_name", "actual"]

/** Step 3: which column holds each field. */
export default function MappingStep({
  read,
  map,
  source,
  scale,
  guess,
  pending,
  onChange,
  onScale,
  onBack,
  onContinue,
}: {
  read: WorkbookRead
  map: DraftMap
  /** Where the current map came from, said above the fields. */
  source: { kind: "saved"; name: string } | { kind: "suggested" }
  scale: PercentScale
  /** What the file suggested; null while it is being read. */
  guess: PercentScaleGuess | null
  pending: boolean
  onChange: (map: DraftMap) => void
  onScale: (scale: PercentScale) => void
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

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Percentages in this file are written as</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["fraction", "0.95"],
              ["whole", "95"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="percent-scale"
                data-slot="radio"
                className="h-4 w-4 accent-blue-600"
                checked={scale === value}
                disabled={pending}
                onChange={() => onScale(value)}
              />
              <span className="font-mono">{label}</span>
              <span className="text-muted-foreground">for 95%</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {guess === null
            ? "Reading the file…"
            : guess.fraction + guess.whole === 0
              ? "No plain numbers for percentage KPIs in this file, so this changes nothing. Cells formatted as % or written with a % sign are read as shown."
              : `Pre-filled from the file: ${guess.fraction} percentage result${guess.fraction === 1 ? "" : "s"} between 0 and 1, ${guess.whole} above 1. Applies only to plain numbers; cells formatted as % or written with a % sign are read as shown.`}
        </p>
      </fieldset>

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
