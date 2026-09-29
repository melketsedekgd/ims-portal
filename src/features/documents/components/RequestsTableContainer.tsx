"use client"

import { Fragment, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, ExternalLink, FileText, Clock, FilterX, Loader2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import ColumnsBar from "@/components/shared/ColumnsBar"
import FilterMenu, { type FilterCategory } from "@/components/shared/FilterMenu"
import ListPagination, { usePagination } from "@/components/shared/ListPagination"
import { LIST_CARD, LIST_HEAD, LIST_HEAD_ROW, listRow } from "@/components/shared/list-styles"
import { CHANGE_REQUEST_STATUS, PILL } from "@/components/shared/status-styles"
import {
  REQUEST_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_PHASE,
  fmtDate,
} from "@/features/documents/components/ChangeRequestStatusBadge"
import {
  DOCUMENT_COLUMNS,
  REQUEST_COLUMNS,
  type DocumentColumnKey,
  type RequestColumnKey,
} from "@/features/documents/columns"
import { CompactProgressTracker } from "@/features/documents/components/ProgressTracker"
import { loadDocumentRequests } from "@/features/documents/mutations"
import type {
  ChangeRequestItem,
  ChangeRequestStatus,
  DocumentListItem,
  DocumentTypeOption,
  RequestableDepartment,
} from "@/features/documents/queries"
import {
  ColumnChoiceProvider,
  useColumnChoice,
} from "@/features/table-preferences/components/ColumnChoiceProvider"
import { cn } from "@/lib/utils"

// A row toggles its expanded panel; the links in it keep working.
const ROW = listRow(false)

type Cell<Row> = { head?: string; cell?: string; title?: (row: Row) => string | undefined; render: (row: Row) => React.ReactNode }

/**
 * The first column takes the table's left inset and the last its right,
 * whichever columns are chosen.
 */
function edge(index: number, count: number) {
  return cn(index === 0 && "pl-4", index === count - 1 && "pr-4")
}

/** For a link inside a row, so following it does not also toggle the row. */
const stop = (e: React.MouseEvent) => e.stopPropagation()

/**
 * The row's toggle, ahead of the first cell's content. No handler of its
 * own: the click reaches the row, which does the toggling.
 */
function RowChevron({ open, label }: { open: boolean; label: string }) {
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      className="mr-1.5 inline-flex align-middle cursor-pointer rounded text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  )
}

// ── Expanded row ──

/** Finished one way or another: not the open request a document is waiting on. */
const CLOSED = new Set<ChangeRequestStatus>(["published", "retired", "rejected"])

/** What the panel's details block shows about the document. */
type PanelDocument = {
  id: string
  documentNumber: string | null
  currentRevision: string | null
  departmentName: string | null
  processName: string | null
  reviewerName: string | null
  storageUrl: string | null
}

const panelDocumentOf = (d: DocumentListItem): PanelDocument => ({
  id: d.id,
  documentNumber: d.documentNumber,
  currentRevision: d.currentRevision,
  departmentName: d.department?.name ?? d.department?.code ?? null,
  processName: d.processName,
  reviewerName: d.reviewerName,
  storageUrl: d.storageUrl,
})

function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">{children || "—"}</dd>
    </div>
  )
}

/**
 * A row's expanded panel: the request's summary and what it changes, the
 * document's details, where the request stands, and a link to the full
 * page. `request` is the open request, or with `lastChange` the latest
 * finished one, which gets no tracker; null shows the details alone.
 */
function RowPanel({
  document: d,
  request,
  lastChange = false,
  loading = false,
  failed = false,
}: {
  document: PanelDocument
  request: ChangeRequestItem | null
  lastChange?: boolean
  loading?: boolean
  failed?: boolean
}) {
  return (
    <div className="space-y-4">
      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading requests…
        </p>
      )}
      {failed && <p className="text-sm text-rose-600 dark:text-rose-400">Couldn&apos;t load this document&apos;s requests.</p>}

      {request && (
        <>
          <div className="space-y-0.5">
            {lastChange && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last change</p>
            )}
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {REQUEST_TYPE_LABEL[request.requestType]} request · {request.requesterName ?? "—"} · {fmtDate(request.createdAt)}
            </p>
          </div>
          <dl className="space-y-3">
            <PanelField label="Reason for change">{request.reasonForChange}</PanelField>
            <PanelField label="What changed">{request.descriptionOfChange}</PanelField>
          </dl>
        </>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <PanelField label="Number · revision">
          <span className="font-mono">
            {d.documentNumber ?? "—"} · {d.currentRevision ?? "—"}
          </span>
        </PanelField>
        <PanelField label="Department · process">
          {[d.departmentName, d.processName].filter(Boolean).join(" · ")}
        </PanelField>
        <PanelField label="Reviewer">{d.reviewerName}</PanelField>
        <PanelField label="Location">
          {d.storageUrl && (
            <a
              href={d.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-coral-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Open the document
            </a>
          )}
        </PanelField>
      </dl>

      {request &&
        (lastChange ? (
          <p className="text-sm text-muted-foreground">No open request</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Approval</p>
            <CompactProgressTracker request={request} />
          </div>
        ))}

      <div className="flex justify-end">
        <Link
          href={`/department/documents/${d.id}`}
          className="text-sm font-medium text-coral-600 hover:underline"
        >
          Open full page →
        </Link>
      </div>
    </div>
  )
}

/**
 * The row under an open one, spanning every chosen column. w-0 keeps the
 * panel from widening the table; min-w fills the row, or on a phone,
 * where the table scrolls sideways, just the visible width, and sticky
 * keeps it in view while the row scrolls.
 */
function PanelRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <TableRow className="border-ink/5 bg-ink/[0.02] hover:bg-ink/[0.02]">
      <TableCell colSpan={colSpan} className="p-0 whitespace-normal">
        <div className="sticky left-0 w-0 min-w-[min(100%,calc(100vw-2rem))] px-4 py-4">{children}</div>
      </TableCell>
    </TableRow>
  )
}

export function RequestsTableContainer({
  activeDocuments,
  waitingOnOthers,
  departments,
  documentTypes,
  savedDocumentColumns,
  savedRequestColumns,
}: {
  activeDocuments: DocumentListItem[]
  waitingOnOthers: ChangeRequestItem[]
  departments: RequestableDepartment[]
  documentTypes: DocumentTypeOption[]
  /** The user's saved columns for each table, raw; null for Default. */
  savedDocumentColumns: string[] | null
  savedRequestColumns: string[] | null
}) {
  const [activeTab, setActiveTab] = useState<"controlled" | "waiting">("controlled")

  return (
    <div className="space-y-4">
      {/* ── Pill Tabs Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-muted/60 dark:bg-muted/30 rounded-xl border border-border/50 gap-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("controlled")}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer",
              activeTab === "controlled"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Controlled Documents
            <span
              className={cn(
                "text-[11px] px-1.5 py-0.5 rounded-full font-semibold",
                activeTab === "controlled"
                  ? "bg-muted text-foreground"
                  : "bg-muted/80 text-muted-foreground"
              )}
            >
              {activeDocuments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("waiting")}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer",
              activeTab === "waiting"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            Waiting on Others
            <span
              className={cn(
                "text-[11px] px-1.5 py-0.5 rounded-full font-semibold",
                activeTab === "waiting"
                  ? "bg-muted text-foreground"
                  : "bg-muted/80 text-muted-foreground"
              )}
            >
              {waitingOnOthers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Both tables stay mounted and the other tab's renders nothing, so
          each keeps its filters, page and column choice across a tab
          switch. A provider remounted by the switch would restart from
          the choice the server read when the page loaded. */}
      <ColumnChoiceProvider registry={DOCUMENT_COLUMNS} saved={savedDocumentColumns} multiDepartment>
        <ControlledDocuments
          shown={activeTab === "controlled"}
          documents={activeDocuments}
          departments={departments}
          documentTypes={documentTypes}
        />
      </ColumnChoiceProvider>
      <ColumnChoiceProvider registry={REQUEST_COLUMNS} saved={savedRequestColumns} multiDepartment>
        <WaitingOnOthers shown={activeTab === "waiting"} requests={waitingOnOthers} documents={activeDocuments} />
      </ColumnChoiceProvider>
    </div>
  )
}

// ── Controlled Documents ──

function ControlledDocuments({
  shown,
  documents,
  departments,
  documentTypes,
}: {
  shown: boolean
  documents: DocumentListItem[]
  departments: RequestableDepartment[]
  documentTypes: DocumentTypeOption[]
}) {
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])

  // Every department a document is filed under, then any other requestable
  // one, as before; those with no documents show a zero count.
  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of documents) {
      if (d.departmentId) {
        map.set(d.departmentId, d.department?.name ?? d.department?.code ?? "Department")
      }
    }
    for (const dept of departments) {
      if (!map.has(dept.id)) map.set(dept.id, dept.name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({
      value: id,
      label: name,
      count: documents.filter((d) => d.departmentId === id).length,
    }))
  }, [documents, departments])

  const filtered = useMemo(
    () =>
      departmentFilter.length === 0
        ? documents
        : documents.filter((d) => departmentFilter.includes(d.departmentId)),
    [documents, departmentFilter]
  )

  const typeName = useMemo(
    () => new Map(documentTypes.map((t) => [t.key, t.name])),
    [documentTypes]
  )

  const { keys: columns, set: setColumns, reset: resetColumns } = useColumnChoice(DOCUMENT_COLUMNS)
  const visible = DOCUMENT_COLUMNS.columns.filter((c) => columns.includes(c.key))

  const pager = usePagination(filtered.length, JSON.stringify(departmentFilter))
  const cardRef = useRef<HTMLDivElement>(null)

  const [openId, setOpenId] = useState<string | null>(null)
  // Each document's requests, loaded on its first open and kept for the
  // next. A failed load is not kept, so opening the row again retries.
  const [requests, setRequests] = useState<Record<string, ChangeRequestItem[] | "loading" | "failed">>({})

  const toggle = (id: string) => {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    const cached = requests[id]
    if (cached !== undefined && cached !== "failed") return
    setRequests((r) => ({ ...r, [id]: "loading" }))
    loadDocumentRequests(id)
      .then((list) => setRequests((r) => ({ ...r, [id]: list ?? [] })))
      .catch(() => setRequests((r) => ({ ...r, [id]: "failed" })))
  }

  if (!shown) return null

  const filterCategories: FilterCategory[] = [
    {
      id: "department",
      label: "Department",
      options: departmentOptions,
      selected: departmentFilter,
      onChange: setDepartmentFilter,
    },
  ]

  const cells: Record<DocumentColumnKey, Cell<DocumentListItem>> = {
    document: {
      cell: "font-medium",
      render: (d) => (
        <>
          <Link href={`/department/documents/${d.id}`} onClick={stop} className="hover:underline">
            {d.name}
          </Link>
          {d.storageUrl && (
            <a
              href={d.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="ml-2 inline-flex align-middle text-muted-foreground hover:text-[var(--ink)]"
              title="Open the document"
              aria-label={`Open ${d.name}`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </>
      ),
    },
    number: { cell: "text-sm text-muted-foreground font-mono", render: (d) => d.documentNumber ?? "—" },
    type: {
      cell: "text-sm",
      render: (d) => (d.documentType ? typeName.get(d.documentType) ?? d.documentType : "—"),
    },
    revision: { cell: "text-sm font-mono", render: (d) => d.currentRevision ?? "—" },
    reviewer: { cell: "text-sm", render: (d) => d.reviewerName ?? "—" },
    department: {
      cell: "text-sm",
      title: (d) => d.department?.name,
      render: (d) => d.department?.code ?? "—",
    },
    process: { cell: "text-sm text-muted-foreground", render: (d) => d.processName ?? "—" },
  }

  return (
    <div ref={cardRef} className={LIST_CARD}>
      <ColumnsBar
        registry={DOCUMENT_COLUMNS}
        keys={columns}
        listed={() => true}
        onChange={setColumns}
        onReset={resetColumns}
        leading={documents.length > 0 && <FilterMenu categories={filterCategories} />}
      />
      <Table>
        <TableHeader>
          <TableRow className={LIST_HEAD_ROW}>
            {visible.map((c, i) => (
              <TableHead key={c.key} className={cn(LIST_HEAD, edge(i, visible.length))}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visible.length} className="h-32 text-center text-sm text-muted-foreground">
                {departmentFilter.length > 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <FilterX className="h-5 w-5 text-muted-foreground/60" />
                    <p>No documents found for the selected department.</p>
                    <Button variant="outline" size="sm" onClick={() => setDepartmentFilter([])}>
                      Clear filter
                    </Button>
                  </div>
                ) : (
                  "No document has been through change control yet. Raise the first request to add one."
                )}
              </TableCell>
            </TableRow>
          ) : (
            filtered.slice(pager.start, pager.end).map((d) => {
              const open = openId === d.id
              return (
                <Fragment key={d.id}>
                  <TableRow className={ROW} onClick={() => toggle(d.id)}>
                    {visible.map((c, i) => (
                      <TableCell
                        key={c.key}
                        className={cn(cells[c.key].cell, edge(i, visible.length))}
                        title={cells[c.key].title?.(d)}
                      >
                        {i === 0 && <RowChevron open={open} label={d.name} />}
                        {cells[c.key].render(d)}
                      </TableCell>
                    ))}
                  </TableRow>
                  {open && (
                    <PanelRow colSpan={visible.length}>
                      <DocumentPanel document={d} requests={requests[d.id]} />
                    </PanelRow>
                  )}
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
      <ListPagination pager={pager} scrollTarget={cardRef} />
    </div>
  )
}

/**
 * A register row's panel: its open request with the tracker, else its
 * last published or retired one as "Last change", else the details alone.
 */
function DocumentPanel({
  document,
  requests,
}: {
  document: DocumentListItem
  requests: ChangeRequestItem[] | "loading" | "failed" | undefined
}) {
  const details = panelDocumentOf(document)
  if (requests === undefined || requests === "loading") return <RowPanel document={details} request={null} loading />
  if (requests === "failed") return <RowPanel document={details} request={null} failed />
  // Newest first, so the first match is the latest.
  const open = requests.find((r) => !CLOSED.has(r.status))
  if (open) return <RowPanel document={details} request={open} />
  const last = requests.find((r) => r.status === "published" || r.status === "retired")
  return <RowPanel document={details} request={last ?? null} lastChange={!!last} />
}

// ── Waiting on Others ──

const REQUEST_TYPE_OPTIONS = (["new", "revision", "deletion"] as const).map((t) => ({
  value: t,
  label: REQUEST_TYPE_LABEL[t],
}))

const REQUEST_CELLS: Record<RequestColumnKey, Cell<ChangeRequestItem>> = {
  document: {
    cell: "font-medium",
    render: (r) => (
      <Link href={`/department/documents/${r.documentId}`} onClick={stop} className="hover:underline">
        {r.documentName}
      </Link>
    ),
  },
  where: {
    cell: "text-sm text-muted-foreground",
    render: (r) => [r.departmentCode, r.processName].filter(Boolean).join(" · ") || "—",
  },
  request: {
    cell: "text-sm",
    render: (r) => (
      <>
        {REQUEST_TYPE_LABEL[r.requestType]}
        {r.proposedRevision && (
          <span className="font-mono text-muted-foreground"> · {r.proposedRevision}</span>
        )}
      </>
    ),
  },
  requester: { cell: "text-sm", render: (r) => r.requesterName ?? "—" },
  status: {
    render: (r) => {
      const phase = STATUS_PHASE[r.status]
      return (
        <div className="flex items-center gap-1.5">
          <span className={`${PILL} ${CHANGE_REQUEST_STATUS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
          {phase && <span className="text-[10px] text-muted-foreground">Phase {phase}</span>}
        </div>
      )
    },
  },
  raised: { cell: "text-sm text-muted-foreground", render: (r) => fmtDate(r.createdAt) },
  waiting_since: { cell: "text-sm text-muted-foreground", render: (r) => fmtDate(r.updatedAt) },
}

/**
 * A request row's document details: from the register when the document
 * is in it, otherwise (a new document, not active yet) what the request
 * itself carries.
 */
function requestPanelDocument(r: ChangeRequestItem, documents: Map<string, DocumentListItem>): PanelDocument {
  const d = documents.get(r.documentId)
  if (d) return panelDocumentOf(d)
  return {
    id: r.documentId,
    documentNumber: null,
    currentRevision: null,
    departmentName: r.departmentName ?? r.departmentCode,
    processName: r.processName,
    reviewerName: null,
    storageUrl: null,
  }
}

function WaitingOnOthers({
  shown,
  requests,
  documents,
}: {
  shown: boolean
  requests: ChangeRequestItem[]
  documents: DocumentListItem[]
}) {
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])

  // The statuses present, in first-seen order, as before.
  const statusOptions = useMemo(() => {
    const counts = new Map<ChangeRequestStatus, number>()
    for (const r of requests) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
    return Array.from(counts.entries()).map(([status, count]) => ({
      value: status,
      label: STATUS_LABEL[status] ?? status,
      count,
    }))
  }, [requests])

  const typeOptions = REQUEST_TYPE_OPTIONS.map((o) => ({
    ...o,
    count: requests.filter((r) => r.requestType === o.value).length,
  }))

  const filtered = useMemo(
    () =>
      requests.filter(
        (r) =>
          (statusFilter.length === 0 || statusFilter.includes(r.status)) &&
          (typeFilter.length === 0 || typeFilter.includes(r.requestType))
      ),
    [requests, statusFilter, typeFilter]
  )

  const { keys: columns, set: setColumns, reset: resetColumns } = useColumnChoice(REQUEST_COLUMNS)
  const visible = REQUEST_COLUMNS.columns.filter((c) => columns.includes(c.key))

  const pager = usePagination(filtered.length, JSON.stringify([statusFilter, typeFilter]))
  const cardRef = useRef<HTMLDivElement>(null)

  const documentById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents])
  const [openId, setOpenId] = useState<string | null>(null)

  if (!shown) return null

  const filterCategories: FilterCategory[] = [
    { id: "status", label: "Status", options: statusOptions, selected: statusFilter, onChange: setStatusFilter },
    { id: "request", label: "Request type", options: typeOptions, selected: typeFilter, onChange: setTypeFilter },
  ]

  return (
    <div ref={cardRef} className={LIST_CARD}>
      <ColumnsBar
        registry={REQUEST_COLUMNS}
        keys={columns}
        listed={() => true}
        onChange={setColumns}
        onReset={resetColumns}
        leading={requests.length > 0 && <FilterMenu categories={filterCategories} />}
      />
      <Table>
        <TableHeader>
          <TableRow className={LIST_HEAD_ROW}>
            {visible.map((c, i) => (
              <TableHead key={c.key} className={cn(LIST_HEAD, edge(i, visible.length))}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visible.length} className="h-28 text-center text-sm text-muted-foreground">
                {statusFilter.length > 0 || typeFilter.length > 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <FilterX className="h-5 w-5 text-muted-foreground/60" />
                    <p>No open requests match the selected filters.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStatusFilter([])
                        setTypeFilter([])
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  "Nothing else is open right now."
                )}
              </TableCell>
            </TableRow>
          ) : (
            filtered.slice(pager.start, pager.end).map((r) => {
              const open = openId === r.id
              return (
                <Fragment key={r.id}>
                  <TableRow className={ROW} onClick={() => setOpenId(open ? null : r.id)}>
                    {visible.map((c, i) => (
                      <TableCell
                        key={c.key}
                        className={cn(REQUEST_CELLS[c.key].cell, edge(i, visible.length))}
                      >
                        {i === 0 && <RowChevron open={open} label={r.documentName} />}
                        {REQUEST_CELLS[c.key].render(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                  {open && (
                    <PanelRow colSpan={visible.length}>
                      <RowPanel document={requestPanelDocument(r, documentById)} request={r} />
                    </PanelRow>
                  )}
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
      <ListPagination pager={pager} scrollTarget={cardRef} />
    </div>
  )
}
