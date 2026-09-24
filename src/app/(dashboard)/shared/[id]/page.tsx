import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/shared/PageHeader";
import RelativeTime from "@/components/shared/RelativeTime";
import { getCurrentUser } from "@/features/auth/queries";
import { exportKpis } from "@/features/kpis/export";
import type { KpiColumnKey } from "@/features/kpis/columns";
import { exportRisks } from "@/features/risks/export";
import type { RiskColumnKey } from "@/features/risks/columns";
import CopyLinkButton from "@/features/shares/components/CopyLinkButton";
import SharedItemsTable from "@/features/shares/components/SharedItemsTable";
import { markShareRead } from "@/features/shares/mutations";
import { getShare, type ShareDetail } from "@/features/shares/queries";
import { itemNoun } from "@/features/shares/types";

/**
 * The same words for a share that does not exist and one the viewer is
 * not part of, so the page cannot be used to learn that an id is real.
 */
function Unavailable() {
  return (
    <div className="flex-1 w-full max-w-[1100px] mx-auto p-4 md:p-6">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-muted-foreground dark:border-slate-800">
        <Lock className="h-5 w-5" />
        This share isn&apos;t available to you
      </div>
    </div>
  );
}

// A fixed set, not the viewer's column choice: a share reads the same for
// everyone it was sent to. Process leads, as in every export.
const SHARED_KPI_COLUMNS: KpiColumnKey[] = ["metric", "dept", "target", "actual", "status"];
const SHARED_RISK_COLUMNS: RiskColumnKey[] = ["risk", "dept", "ref", "ls", "score", "band", "status", "owner"];

/**
 * The rows as the viewer's own RLS returns them, at the share's period.
 * The export actions are the read: an item the viewer cannot open does not
 * come back, and the difference is only counted.
 */
async function loadRows(share: ShareDetail) {
  const query = `?year=${share.year}&quarter=${share.quarter}`;

  if (share.itemType === "kpi") {
    const result = await exportKpis(share.itemIds, share.year, share.quarter, SHARED_KPI_COLUMNS);
    const columns = result.ok ? result.columns : [];
    const rows = result.ok ? result.rows : [];
    return {
      headers: columns.map((c) => c.header),
      linkColumn: columns.findIndex((c) => c.key === "metric"),
      rows: rows.map((r) => ({
        id: r.id,
        href: `/department/kpis/${r.id}${query}`,
        cells: columns.map((c) => String(r[c.key] ?? "")),
      })),
    };
  }

  const result = await exportRisks(share.itemIds, share.year, share.quarter, SHARED_RISK_COLUMNS);
  const columns = result.ok ? result.columns : [];
  const rows = result.ok ? result.rows : [];
  return {
    headers: columns.map((c) => c.header),
    linkColumn: columns.findIndex((c) => c.key === "risk"),
    rows: rows.map((r) => ({
      id: r.id,
      href: `/department/risks/${r.id}${query}`,
      cells: columns.map((c) => String(r[c.key] ?? "")),
    })),
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, share] = await Promise.all([getCurrentUser(), getShare(id)]);

  if (!user || !share) return <Unavailable />;

  const isSender = share.senderId === user.id;
  const mine = share.recipients.find((r) => r.id === user.id);
  // Read before marking, so the page can still say it was new.
  const isNew = !isSender && !!mine && mine.readAt === null;
  if (isNew) await markShareRead(share.id);

  const table = await loadRows(share);
  const total = share.itemIds.length;
  const hiddenCount = Math.max(0, total - table.rows.length);

  return (
    <div className="flex-1 space-y-6 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <PageHeader
        title={`${total} ${itemNoun(share.itemType, total)} shared by ${isSender ? "you" : share.senderName}`}
        beside={isNew ? <Badge className="bg-coral text-white">New</Badge> : undefined}
        description={
          <>
            {share.quarter} {share.year} · shared <RelativeTime iso={share.createdAt} />
            {isSender && (
              <>
                <br />
                Shared by you with {share.recipients.map((r) => r.name).join(", ")}
              </>
            )}
          </>
        }
        actions={<CopyLinkButton shareId={share.id} />}
      />

      {share.note && (
        <div className="whitespace-pre-wrap rounded-lg bg-slate-100 px-4 py-3 text-sm text-ink-2 dark:bg-slate-800/60">
          {share.note}
        </div>
      )}

      <SharedItemsTable
        headers={table.headers}
        rows={table.rows}
        linkColumn={table.linkColumn}
        hiddenCount={hiddenCount}
      />
    </div>
  );
}
