"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, FileText, Clock } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChangeRequestStatusBadge,
  REQUEST_TYPE_LABEL,
  STATUS_PHASE,
  fmtDate,
} from "@/features/documents/components/ChangeRequestStatusBadge"
import { RequestChangeButton } from "@/features/documents/components/DocumentActions"
import type {
  ChangeRequestItem,
  DocumentListItem,
  DocumentTypeOption,
  RequestableDepartment,
  WorkflowSettingsItem,
} from "@/features/documents/queries"
import { cn } from "@/lib/utils"

export function RequestsTableContainer({
  activeDocuments,
  waitingOnOthers,
  departments,
  documentTypes,
  workflowSettings,
  defaultDepartmentId,
}: {
  activeDocuments: DocumentListItem[]
  waitingOnOthers: ChangeRequestItem[]
  departments: RequestableDepartment[]
  documentTypes: DocumentTypeOption[]
  workflowSettings: WorkflowSettingsItem[]
  defaultDepartmentId: string | null
}) {
  const [activeTab, setActiveTab] = useState<"controlled" | "waiting">("controlled")

  return (
    <div className="space-y-4">
      {/* ── Table Header / Toolbar with Pill Tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Pill Tabs Switcher */}
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

        {/* Action Button */}
        <RequestChangeButton
          documents={activeDocuments}
          departments={departments}
          documentTypes={documentTypes}
          workflowSettings={workflowSettings}
          defaultDepartmentId={defaultDepartmentId}
        />
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
              {activeDocuments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No document has been through change control yet. Raise the
                    first request to add one.
                  </TableCell>
                </TableRow>
              ) : (
                activeDocuments.map((d) => (
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
              {waitingOnOthers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    Nothing else is open right now.
                  </TableCell>
                </TableRow>
              ) : (
                waitingOnOthers.map((r) => {
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
