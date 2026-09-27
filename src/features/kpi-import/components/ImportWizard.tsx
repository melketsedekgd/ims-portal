"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import PageHeader from "@/components/shared/PageHeader"
import { cn } from "@/lib/utils"
import { readPercentScale, readWorkbook, type PercentScaleGuess, type WorkbookRead } from "../parse"
import { cancelImport, commitImport, stageImport, type CommitCounts } from "../mutations"
import type { ImportReview, ReviewRow } from "../queries"
import { normaliseHeader, sameHeaders, suggestColumns } from "../headers"
import type { PercentScale } from "../review"
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
import ResultStep from "./ResultStep"

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
  const [scale, setScale] = useState<PercentScale>("whole")
  const [scaleGuess, setScaleGuess] = useState<PercentScaleGuess | null>(null)
  const [review, setReview] = useState<ImportReview | null>(null)
  const [counts, setCounts] = useState<CommitCounts | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const department = departments.find((d) => d.id === departmentId)
  const quarter = quarters.find((q) => q.id === periodId)

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
   * Pre-fill the percentage choice from the file, for the KPI name and
   * result columns now mapped. Re-read when either column changes, since the
   * rows it looks at change with them; the reviewer's own pick is replaced.
   */
  const guessScale = (r: WorkbookRead, m: DraftMap) => {
    if (!file) return
    setScaleGuess(null)
    const fd = new FormData()
    fd.set("file", file)
    fd.set("sheet", r.sheet)
    fd.set("headerRow", String(r.headerRow))
    fd.set("departmentId", departmentId)
    fd.set("kpiColumn", m.kpi_name)
    fd.set("actualColumn", m.actual)
    startTransition(async () => {
      const result = await readPercentScale(fd)
      const guess = result.ok ? result.guess : { scale: "whole" as const, fraction: 0, whole: 0 }
      setScaleGuess(guess)
      setScale(guess.scale)
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
    const next = Object.fromEntries(
      IMPORT_FIELDS.map((f) => [f, saved ? display(saved.columnMap[f]) : (suggested[f] ?? "")])
    ) as DraftMap
    setSavedMapping(saved ?? null)
    setMap(next)
    guessScale(r, next)
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
    fd.set("percentScale", scale)
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

  /** The staged draft is abandoned; mapping again stages a new one. */
  const backToMapping = () => {
    if (!review) return
    startTransition(async () => {
      const result = await cancelImport(review.batchId)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setReview(null)
      setStep(2)
    })
  }

  const cancel = () => {
    if (!review) return
    startTransition(async () => {
      const result = await cancelImport(review.batchId)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success("Import cancelled. Nothing was recorded.")
      router.push("/department/kpis")
    })
  }

  const commit = (mappingName: string | null) => {
    if (!review || !read) return
    startTransition(async () => {
      const result = await commitImport(
        review.batchId,
        mappingName
          ? {
              name: mappingName,
              headers: read.headers,
              columnMap: Object.fromEntries(IMPORT_FIELDS.filter((f) => map[f]).map((f) => [f, map[f]])),
            }
          : null
      )
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      if (result.warning) toast.warning(result.warning)
      if (result.review) setReview(result.review)
      setCounts(result.counts)
      setStep(4)
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
            scale={scale}
            guess={scaleGuess}
            pending={pending}
            onChange={(next) => {
              if (next.kpi_name !== map.kpi_name || next.actual !== map.actual) guessScale(read, next)
              setMap(next)
            }}
            onScale={setScale}
            onBack={() => setStep(1)}
            onContinue={stage}
          />
        )}

        {step === 3 && review && (
          <ReviewStep
            review={review}
            map={map}
            onRows={updateRows}
            footer={
              <ReviewFooter
                review={review}
                defaultMappingName={savedMapping?.name ?? `${department?.code ?? ""} KPI report`.trim()}
                pending={pending}
                onBack={backToMapping}
                onCancel={cancel}
                onImport={commit}
              />
            }
          />
        )}

        {step === 4 && review && counts && quarter && (
          <ResultStep
            review={review}
            counts={counts}
            listHref={`/department/kpis?year=${quarter.year}&quarter=${quarter.label}${
              departments.length > 1 && department ? `&dept=${department.code}` : ""
            }`}
          />
        )}
      </div>
    </div>
  )
}

/** The review's last line: what an import would do, and the buttons that do it. */
function ReviewFooter({
  review,
  defaultMappingName,
  pending,
  onBack,
  onCancel,
  onImport,
}: {
  review: ImportReview
  defaultMappingName: string
  pending: boolean
  onBack: () => void
  onCancel: () => void
  onImport: (mappingName: string | null) => void
}) {
  const [saveMapping, setSaveMapping] = useState(true)
  const [mappingName, setMappingName] = useState(defaultMappingName)

  const ready = review.rows.filter((r) => r.status === "ready")
  const toCheck = review.rows.filter((r) => r.status === "check").length
  const keep = ready.filter(
    (r) => r.kpiId && review.existing[r.kpiId] !== undefined && !r.replaceExisting
  ).length
  const writes = ready.length - keep
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          data-slot="checkbox"
          className="h-4 w-4 accent-blue-600"
          checked={saveMapping}
          onChange={(e) => setSaveMapping(e.target.checked)}
        />
        Save this mapping as
        <input
          aria-label="Mapping name"
          value={mappingName}
          disabled={!saveMapping}
          onChange={(e) => setMappingName(e.target.value)}
          className="h-8 w-44 rounded-md border border-input bg-white dark:bg-slate-950 px-2 text-sm disabled:opacity-50"
        />
        for next time
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground mr-2">
          {toCheck > 0 ? `${plural(toCheck, "row")} still to check · ` : ""}
          {keep > 0 ? `${plural(keep, "existing result")} kept (Replace not ticked)` : ""}
        </p>
        <Button variant="outline" onClick={onBack} disabled={pending}>
          Back to mapping
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel import
        </Button>
        <Button
          onClick={() => onImport(saveMapping && mappingName.trim() ? mappingName.trim() : null)}
          disabled={pending || toCheck > 0 || ready.length === 0}
        >
          {pending ? "Importing…" : `Import ${plural(writes, "result")}`}
        </Button>
      </div>
    </div>
  )
}
