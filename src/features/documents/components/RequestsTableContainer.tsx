"use client"

import { useMemo, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  ChangeRequestStatusBadge,
  REQUEST_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_PHASE,
  fmtDate,
} from "@/features/documents/components/ChangeRequestStatusBadge"
import type {
  ChangeRequestItem,
  ChangeRequestStatus,
  DocumentListItem,
  RequestableDepartment,
} from "@/features/documents/queries"
import { cn } from "@/lib/utils"

export function RequestsTableContainer({
  activeDocuments,
  waitingOnOthers,
  departments,
}: {
  activeDocuments: DocumentListItem[]
  waitingOnOthers: ChangeRequestItem[]
  departments: RequestableDepartment[]
}) {
  const [activeTab, setActiveTab] = useState<"controlled" | "waiting">("controlled")

  // ── Filters for Controlled Documents ──
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")

  // ── Filters for Waiting on Others ──
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedRequestType, setSelectedRequestType] = useState<string>("all")

  // ── Controlled Documents: Department options map ──
  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of activeDocuments) {
      if (d.departmentId) {
        map.set(d.departmentId, d.department?.name ?? d.department?.code ?? "Department")
      }
    }
    for (const dept of departments) {
      if (!map.has(dept.id)) {
        map.set(dept.id, dept.name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [activeDocuments, departments])

  const deptItems: Record<string, string> = useMemo(() => {
    return {
      all: "All departments",
      ...Object.fromEntries(departmentOptions.map((d) => [d.id, d.name])),
    }
  }, [departmentOptions])

  // Filtered Controlled Documents
  const filteredDocuments = useMemo(() => {
    if (selectedDepartment === "all") return activeDocuments
    return activeDocuments.filter((d) => d.departmentId === selectedDepartment)
  }, [activeDocuments, selectedDepartment])

  // ── Waiting on Others: Status options ──
  const statusOptions = useMemo(() => {
    const set = new Set<ChangeRequestStatus>()
    for (const r of waitingOnOthers) {
      set.add(r.status)
    }
    return Array.from(set)
  }, [waitingOnOthers])

  const statusItems: Record<string, string> = useMemo(() => {
    return {
      all: "All statuses",
      ...Object.fromEntries(statusOptions.map((s) => [s, STATUS_LABEL[s] ?? s])),
    }
  }, [statusOptions])

  const requestTypeItems: Record<string, string> = {
    all: "All request types",
    new: REQUEST_TYPE_LABEL.new,
    revision: REQUEST_TYPE_LABEL.revision,
    deletion: REQUEST_TYPE_LABEL.deletion,
  }

  // Filtered Waiting on Others
  const filteredWaitingOnOthers = useMemo(() => {
    return waitingOnOthers.filter((r) => {
      const matchStatus = selectedStatus === "all" || r.status === selectedStatus
      const matchType =
        selectedRequestType === "all" || r.requestType === selectedRequestType
      return matchStatus && matchType
    })
  }, [waitingOnOthers, selectedStatus, selectedRequestType])

  return (
    <div className="space-y-4">
      {/* ── Table Toolbar with Pill Tabs and Filter Dropdowns ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Pill Tabs Switcher */}
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

        {/* Right: Tab-specific Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "controlled" ? (
            /* ── Controlled Documents Filter: Department ── */
            <Select
              items={deptItems}
              value={selectedDepartment}
              onValueChange={(v) => v && setSelectedDepartment(String(v))}
            >
              <SelectTrigger
                aria-label="Filter by department"
                title={deptItems[selectedDepartment]}
                className="w-[180px] h-9 text-xs bg-white dark:bg-slate-950 border-input"
              >
                <SelectValue>
                  {(v: string) => (
                    <span className="truncate">{deptItems[v] ?? v}</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-w-[280px]">
                <SelectItem value="all">All departments</SelectItem>
                {departmentOptions.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <span className="truncate">{dept.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            /* ── Waiting on Others Filters: Status & Request ── */
            <>
              {/* Status Filter */}
              <Select
                items={statusItems}
                value={selectedStatus}
                onValueChange={(v) => v && setSelectedStatus(String(v))}
              >
                <SelectTrigger
                  aria-label="Filter by status"
                  title={statusItems[selectedStatus]}
                  className="w-[190px] h-9 text-xs bg-white dark:bg-slate-950 border-input"
                >
                  <SelectValue>
                    {(v: string) => (
                      <span className="truncate">{statusItems[v] ?? v}</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-[280px]">
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      <span className="truncate">
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Request Type Filter */}
              <Select
                items={requestTypeItems}
                value={selectedRequestType}
                onValueChange={(v) => v && setSelectedRequestType(String(v))}
              >
                <SelectTrigger
                  aria-label="Filter by request type"
                  title={requestTypeItems[selectedRequestType]}
                  className="w-[160px] h-9 text-xs bg-white dark:bg-slate-950 border-input"
                >
                  <SelectValue>
                    {(v: string) => (
                      <span className="truncate">
                        {requestTypeItems[v] ?? v}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All request types</SelectItem>
                  <SelectItem value="new">New document</SelectItem>
                  <SelectItem value="revision">Revision</SelectItem>
                  <SelectItem value="deletion">Deletion</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {/* ── Single Unified Table ── */}
      <div className="rounded-md border bg-white dark:bg-slate-950 shadow-xs overflow-hidden">
        {activeTab === "controlled" ? (
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="h-10 pl-6">Document</TableHead>
                <TableHead className="h-10">Number</TableHead>
                <TableHead className="h-10">Current revision</TableHead>
                <TableHead className="h-10">Reviewer</TableHead>
                <TableHead className="h-10">Department</TableHead>
                <TableHead className="h-10 pr-6">Process</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    {selectedDepartment !== "all" ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-4">
                        <FilterX className="h-5 w-5 text-muted-foreground/60" />
                        <p>No documents found for the selected department.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDepartment("all")}
                        >
                          Clear filter
                        </Button>
                      </div>
                    ) : (
                      "No document has been through change control yet. Raise the first request to add one."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((d) => (
                  <TableRow
                    key={d.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                  >
                    <TableCell className="pl-6 font-medium">
                      <Link
                        href={`/department/documents/${d.id}`}
                        className="hover:underline"
                      >
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
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {d.documentNumber ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {d.currentRevision ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.reviewerName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm" title={d.department?.name}>
                      {d.department?.code ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground pr-6">
                      {d.processName ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="h-10 pl-6">Document</TableHead>
                <TableHead className="h-10">Department / process</TableHead>
                <TableHead className="h-10">Request</TableHead>
                <TableHead className="h-10">Status</TableHead>
                <TableHead className="h-10 pr-6">Waiting since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWaitingOnOthers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-28 text-center text-sm text-muted-foreground"
                  >
                    {selectedStatus !== "all" || selectedRequestType !== "all" ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-4">
                        <FilterX className="h-5 w-5 text-muted-foreground/60" />
                        <p>No open requests match the selected filters.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedStatus("all")
                            setSelectedRequestType("all")
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
                filteredWaitingOnOthers.map((r) => {
                  const phase = STATUS_PHASE[r.status]
                  return (
                    <TableRow
                      key={r.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <TableCell className="pl-6 font-medium">
                        <Link
                          href={`/department/documents/${r.documentId}`}
                          className="hover:underline"
                        >
                          {r.documentName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[r.departmentCode, r.processName]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {REQUEST_TYPE_LABEL[r.requestType]}
                        {r.proposedRevision && (
                          <span className="font-mono text-muted-foreground">
                            {" "}
                            · {r.proposedRevision}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ChangeRequestStatusBadge status={r.status} />
                          {phase && (
                            <span className="text-[10px] text-muted-foreground">
                              Phase {phase}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground pr-6">
                        {fmtDate(r.updatedAt)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
