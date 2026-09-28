import { ExternalLink, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import EvidenceDialog from "@/features/evidence/components/EvidenceDialog"
import DeleteEvidenceButton from "@/features/evidence/components/DeleteEvidenceButton"
import type { Evidence } from "@/features/evidence/queries"
import { parseHttpUrl } from "@/features/evidence/url"
import type { Enums } from "@/types/database"

const TYPE_LABEL: Record<Enums<"evidence_type">, string> = {
  document: "Document",
  link: "Link",
  screenshot: "Screenshot",
  report: "Report",
  ticket: "Ticket",
  other: "Other",
}

/**
 * Evidence for one risk/KPI/objective/action, additive alongside that
 * record's own free-text evidence field — this list does not replace it.
 * Most backfilled rows carry only a name, with no location: the free text
 * they came from was often just a description, not a link or file
 * reference, and that is expected, not a missing value.
 */
export default function EvidenceList({
  evidence,
  linkedType,
  linkedId,
  canManage,
  lockedMessage = null,
  path,
}: {
  evidence: Evidence[]
  linkedType: Enums<"action_source">
  linkedId: string
  /** Whether the current user may add or delete evidence here. */
  canManage: boolean
  /**
   * Why this record's quarter no longer takes evidence ("Q1 2026 was
   * received by IMS"), or null when it does. Hides add and delete; the
   * evidence itself still shows. See features/quarter-lock.
   */
  lockedMessage?: string | null
  /** The page to revalidate after add/delete. */
  path: string
}) {
  const editable = canManage && !lockedMessage
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {evidence.length === 0
            ? "No evidence recorded."
            : `${evidence.length} ${evidence.length === 1 ? "item" : "items"}`}
        </p>
        {editable && <EvidenceDialog linkedType={linkedType} linkedId={linkedId} path={path} />}
        {/* Stands in for the missing button, so only where it would have been. */}
        {canManage && lockedMessage && (
          <Tooltip>
            <TooltipTrigger
              render={<span tabIndex={0} />}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-default"
            >
              <Lock className="h-3 w-3" />
              Locked
            </TooltipTrigger>
            <TooltipContent>{lockedMessage}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {evidence.length > 0 && (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          {evidence.map((e) => {
            // Any type can carry a web address, not only "link"; only
            // http(s) is ever made clickable.
            const url = e.location ? parseHttpUrl(e.location) : null
            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-white dark:bg-slate-950"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {url ? (
                      <a
                        href={url.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={e.name}
                        className="inline-flex items-center gap-1 min-w-0 max-w-full text-sm font-medium text-primary hover:underline underline-offset-2"
                      >
                        <span className="truncate">{e.name}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-sm font-medium truncate" title={e.name}>
                        {e.name}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {TYPE_LABEL[e.type]}
                    </Badge>
                    {e.source === "backfill" && (
                      <span
                        className="text-[10px] text-muted-foreground italic"
                        title="Migrated from the report's free-text evidence field"
                      >
                        backfilled
                      </span>
                    )}
                  </div>
                  {url ? (
                    <p className="text-xs text-muted-foreground truncate" title={url.href}>
                      {url.hostname}
                    </p>
                  ) : (
                    e.location && (
                      <p className="text-xs text-muted-foreground truncate" title={e.location}>
                        {e.location}
                      </p>
                    )
                  )}
                </div>
                {editable && <DeleteEvidenceButton id={e.id} path={path} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
