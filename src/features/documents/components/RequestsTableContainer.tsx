"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ExternalLink, FileText, Clock, FilterX } from "lucide-react"
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

// Rows hold links rather than opening anything themselves.
const ROW = listRow(false, false)

type Cell<Row> = { head?: string; cell?: string; title?: (row: Row) => string | undefined; render: (row: Row) => React.ReactNode }

/**
 * The first column takes the table's left inset and the last its right,
 * whichever columns are chosen.
 */
function edge(index: number, count: number) {
  return cn(index === 0 && "pl-4", index === count - 1 && "pr-4")
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
        <WaitingOnOthers shown={activeTab === "waiting"} requests={waitingOnOthers} />
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
          <Link href={`/department/documents/${d.id}`} className="hover:underline">
            {d.name}
          </Link>
          {d.storageUrl && (
            <a
              href={d.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
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
            filtered.slice(pager.start, pager.end).map((d) => (
              <TableRow key={d.id} className={ROW}>
                {visible.map((c, i) => (
                  <TableCell
                    key={c.key}
                    className={cn(cells[c.key].cell, edge(i, visible.length))}
                    title={cells[c.key].title?.(d)}
                  >
                    {cells[c.key].render(d)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <ListPagination pager={pager} scrollTarget={cardRef} />
    </div>
  )
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
      <Link href={`/department/documents/${r.documentId}`} className="hover:underline">
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

function WaitingOnOthers({ shown, requests }: { shown: boolean; requests: ChangeRequestItem[] }) {
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
            filtered.slice(pager.start, pager.end).map((r) => (
              <TableRow key={r.id} className={ROW}>
                {visible.map((c, i) => (
                  <TableCell
                    key={c.key}
                    className={cn(REQUEST_CELLS[c.key].cell, edge(i, visible.length))}
                  >
                    {REQUEST_CELLS[c.key].render(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <ListPagination pager={pager} scrollTarget={cardRef} />
    </div>
  )
}
