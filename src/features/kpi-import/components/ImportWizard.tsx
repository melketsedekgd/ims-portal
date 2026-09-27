"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import PageHeader from "@/components/shared/PageHeader"
import { cn } from "@/lib/utils"
import { readWorkbook, type WorkbookRead } from "../parse"
import { stageImport } from "../mutations"
import type { ImportReview, ReviewRow } from "../queries"
import { normaliseHeader, sameHeaders, suggestColumns } from "../headers"
import {
  IMPORT_FIELDS,
  type ImportDepartment,
  type ImportQuarter,
  type QuarterLock,
  type SavedMapping,
} from "../types"
import SourceStep from "./SourceStep"
import HeaderRowStep from "./HeaderRowStep"
import MappingStep, { type DraftMap } from "./MappingStep"
import ReviewStep from "./ReviewStep"

const STEPS = ["Upload", "Header row", "Map columns", "Review", "Import"] as const
type Step = 0 | 1 | 2 | 3 | 4

/**
 * The import, step by step. Steps 1–3 happen here in the browser with the
 * file held in memory and re-sent to readWorkbook on each change; nothing is
 * written until step 3 stages the rows. From then on the draft batch in
 * import_rows is the state, and the review edits it row by row.
 */
export default function ImportWizard({
  departments,
  quarters,
  locks,
  mappings,
  isAdmin,
  defaultDepartmentId,
  defaultPeriodId,
}: {
  departments: ImportDepartment[]
  quarters: ImportQuarter[]
  locks: QuarterLock[]
  mappings: SavedMapping[]
  isAdmin: boolean
  defaultDepartmentId: string
  defaultPeriodId: string
}) {
  const [step, setStep] = useState<Step>(0)
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId)
  const [periodId, setPeriodId] = useState(defaultPeriodId)
  const [file, setFile] = useState<File | null>(null)
  const [read, setRead] = useState<WorkbookRead | null>(null)
  const [map, setMap] = useState<DraftMap>({ kpi_name: "", actual: "", remark: "", evidence: "" })
  const [savedMapping, setSavedMapping] = useState<SavedMapping | null>(null)
  const [review, setReview] = useState<ImportReview | null>(null)
  const [pending, startTransition] = useTransition()

  /** Parse the file (again) for a sheet and header row; the guess when omitted. */
  const load = (sheet?: string, headerRow?: number, then?: (r: WorkbookRead) => void) => {
    if (!file) return
    const fd = new FormData()
    fd.set("file", file)
    if (sheet) fd.set("sheet", sheet)
    if (headerRow) fd.set("headerRow", String(headerRow))
    startTransition(async () => {
      const result = await readWorkbook(fd)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setRead(result.data)
      then?.(result.data)
    })
  }

  /**
   * The department's saved mapping when its headers are this sheet's
   * headers, otherwise a guess from the header text. Saved values are
   * normalised; they are mapped back to this sheet's display names.
   */
  const startMapping = (r: WorkbookRead) => {
    const saved = mappings.find(
      (m) => m.departmentId === departmentId && sameHeaders(m.headers, r.headers)
    )
    const display = (n: string | undefined) =>
      n ? (r.headers.find((h) => normaliseHeader(h) === n) ?? "") : ""
    const suggested = suggestColumns(r.headers)
    setSavedMapping(saved ?? null)
    setMap(
      Object.fromEntries(
        IMPORT_FIELDS.map((f) => [f, saved ? display(saved.columnMap[f]) : (suggested[f] ?? "")])
      ) as DraftMap
    )
    setStep(2)
  }

  /** Stage the sheet as a draft batch and open the review. */
  const stage = () => {
    if (!file || !read) return
    const fd = new FormData()
    fd.set("file", file)
    fd.set("departmentId", departmentId)
    fd.set("periodId", periodId)
    fd.set("sheet", read.sheet)
    fd.set("headerRow", String(read.headerRow))
    fd.set(
      "columnMap",
      JSON.stringify(Object.fromEntries(IMPORT_FIELDS.filter((f) => map[f]).map((f) => [f, map[f]])))
    )
    startTransition(async () => {
      const result = await stageImport(fd)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setReview(result.review)
      setStep(3)
    })
  }

  const updateRows = (update: (rows: ReviewRow[]) => ReviewRow[]) =>
    setReview((r) => (r ? { ...r, rows: update(r.rows) } : r))

  return (
    <div className="flex-1 space-y-6 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="flex items-start gap-3">
        <Link
          href="/department/kpis"
          aria-label="Back to KPIs"
          className={`${buttonVariants({ variant: "ghost", size: "icon" })} shrink-0 mt-0.5`}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <PageHeader
            title="Import KPI results"
            description="Upload the quarterly Excel report, check every row, then import."
          />
        </div>
      </div>

      <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="Import steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "rounded-full px-3 py-1",
              i === step
                ? "bg-ink text-white font-medium dark:bg-slate-100 dark:text-slate-900"
                : i < step
                  ? "bg-ink/5 text-ink"
                  : "border border-slate-300 text-muted-foreground dark:border-slate-700"
            )}
          >
            {i < step ? "✓ " : `${i + 1} · `}
            {label}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border bg-white dark:bg-slate-950 p-5 shadow-sm">
        {step === 0 && (
          <SourceStep
            departments={departments}
            quarters={quarters}
            locks={locks}
            isAdmin={isAdmin}
            departmentId={departmentId}
            periodId={periodId}
            file={file}
            pending={pending}
            onDepartment={setDepartmentId}
            onPeriod={setPeriodId}
            onFile={(f) => {
              setFile(f)
              setRead(null)
            }}
            onContinue={() => load(undefined, undefined, () => setStep(1))}
          />
        )}

        {step === 1 && read && file && (
          <HeaderRowStep
            // Remounted per sheet and row, so the typed row number resets.
            key={`${read.sheet}-${read.headerRow}`}
            fileName={file.name}
            read={read}
            pending={pending}
            onChange={(sheet, headerRow) => load(sheet, headerRow)}
            onBack={() => setStep(0)}
            onContinue={() => startMapping(read)}
          />
        )}

        {step === 2 && read && (
          <MappingStep
            read={read}
            map={map}
            source={savedMapping ? { kind: "saved", name: savedMapping.name } : { kind: "suggested" }}
            pending={pending}
            onChange={setMap}
            onBack={() => setStep(1)}
            onContinue={stage}
          />
        )}

        {step === 3 && review && (
          <ReviewStep
            review={review}
            map={map}
            onRows={updateRows}
            footer={<ReviewSummary review={review} onBack={() => setStep(2)} />}
          />
        )}
      </div>
    </div>
  )
}

/** What an import of the rows as they stand would do. */
function ReviewSummary({ review, onBack }: { review: ImportReview; onBack: () => void }) {
  const ready = review.rows.filter((r) => r.status === "ready")
  const toCheck = review.rows.filter((r) => r.status === "check").length
  const keep = ready.filter((r) => r.kpiId && review.existing[r.kpiId] !== undefined && !r.replaceExisting).length
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <Button variant="outline" onClick={onBack}>
        Back to mapping
      </Button>
      <p className="text-sm text-muted-foreground">
        {toCheck > 0 ? `${toCheck} row${toCheck === 1 ? "" : "s"} still to check · ` : ""}
        {ready.length - keep} result{ready.length - keep === 1 ? "" : "s"} to import
        {keep > 0 ? ` · ${keep} already recorded and kept` : ""}
      </p>
    </div>
  )
}
