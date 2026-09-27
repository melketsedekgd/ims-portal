"use client"

import { Lock, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import Choice from "./Choice"
import {
  importBlock,
  type ImportDepartment,
  type ImportQuarter,
  type QuarterLock,
} from "../types"

/** Refused before upload so the message is ours, not the body-limit error's. */
const MAX_UPLOAD_BYTES = 7 * 1024 * 1024

/** Step 1: department, quarter and file. */
export default function SourceStep({
  departments,
  quarters,
  locks,
  isAdmin,
  departmentId,
  periodId,
  file,
  pending,
  onDepartment,
  onPeriod,
  onFile,
  onContinue,
}: {
  departments: ImportDepartment[]
  quarters: ImportQuarter[]
  locks: QuarterLock[]
  isAdmin: boolean
  departmentId: string
  periodId: string
  file: File | null
  pending: boolean
  onDepartment: (id: string) => void
  onPeriod: (id: string) => void
  onFile: (file: File | null) => void
  onContinue: () => void
}) {
  const quarter = quarters.find((q) => q.id === periodId)
  const block = quarter ? importBlock(quarter, departmentId, locks, isAdmin) : null
  const tooBig = !!file && file.size > MAX_UPLOAD_BYTES

  // The quarter list is marked per department: a quarter locked for SRD may
  // be open for IT.
  const quarterItems = quarters.map((q) => {
    const b = importBlock(q, departmentId, locks, isAdmin)
    return { value: q.id, label: `${q.label} ${q.year}${b ? ` · ${b.label}` : ""}` }
  })

  return (
    <div className="space-y-5 max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="import-department">Department</Label>
          {departments.length > 1 ? (
            <Choice
              id="import-department"
              value={departmentId}
              onChange={onDepartment}
              items={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          ) : (
            <p id="import-department" className="h-8 flex items-center text-sm">
              {departments[0]?.name}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="import-quarter">Import into quarter</Label>
          <Choice
            id="import-quarter"
            value={periodId}
            onChange={onPeriod}
            items={quarterItems}
            placeholder="Choose a quarter"
          />
        </div>
      </div>

      {block && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {block.kind === "locked"
              ? `${quarter?.label} ${quarter?.year} has been submitted for sign-off, so its results can no longer change. Choose another quarter.`
              : `${quarter?.label} ${quarter?.year} is closed. Only an IMS admin can record results in a closed quarter. Choose another quarter.`}
          </span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="import-file">Excel report (.xlsx)</Label>
        <input
          id="import-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50 dark:file:bg-slate-950"
        />
        <p className="text-xs text-muted-foreground">
          The file is read once to stage its rows and is not kept.
        </p>
        {tooBig && (
          <p className="text-sm text-rose-700">
            That file is over 7 MB. Save a copy with only the KPI sheet and upload that.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={!file || tooBig || !!block || !quarter || pending} className="gap-2">
          <Upload className="h-4 w-4" />
          {pending ? "Reading…" : "Upload and continue"}
        </Button>
      </div>
    </div>
  )
}
