import { Badge } from "@/components/ui/badge"
import EvidenceDialog from "@/features/evidence/components/EvidenceDialog"
import DeleteEvidenceButton from "@/features/evidence/components/DeleteEvidenceButton"
import type { Evidence } from "@/features/evidence/queries"
import type { Enums } from "@/types/database"

const TYPE_LABEL: Record<Enums<"evidence_type">, string> = {
  document: "Document",
  link: "Link",
  screenshot: "Screenshot",
  report: "Report",
  ticket: "Ticket",
  other: "Other",
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
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
  path,
}: {
  evidence: Evidence[]
  linkedType: Enums<"action_source">
  linkedId: string
  /** Whether the current user may add or delete evidence here. */
  canManage: boolean
  /** The page to revalidate after add/delete. */
  path: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {evidence.length === 0
            ? "No evidence recorded."
            : `${evidence.length} ${evidence.length === 1 ? "item" : "items"}`}
        </p>
        {canManage && <EvidenceDialog linkedType={linkedType} linkedId={linkedId} path={path} />}
      </div>

      {evidence.length > 0 && (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          {evidence.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 px-3 py-2 bg-white dark:bg-slate-950"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate" title={e.name}>
                    {e.name}
                  </span>
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
                {e.location &&
                  (isHttpUrl(e.location) ? (
                    <a
                      href={e.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                    >
                      {e.location}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground truncate">{e.location}</p>
                  ))}
              </div>
              {canManage && <DeleteEvidenceButton id={e.id} path={path} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
