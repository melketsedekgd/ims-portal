import { CheckCircle2, Inbox, ShieldCheck } from "lucide-react";
import { getApprovalQueues } from "@/features/documents/queries";
import DecisionPanel from "@/features/documents/components/DecisionPanel";
import type { ChangeRequestItem, ApprovalStage } from "@/features/documents/queries";

function Queue({
  title,
  hint,
  icon,
  stage,
  items,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  stage: ApprovalStage;
  items: ChangeRequestItem[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">{icon}</div>
        <div>
          <h2 className="text-sm font-bold tracking-tight">
            {title}
            <span className="ml-2 text-xs font-medium text-muted-foreground">{items.length}</span>
          </h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-6 text-center">
          Nothing is waiting for your decision.
        </p>
      ) : (
        items.map((r) => <DecisionPanel key={r.id} request={r} stage={stage} />)
      )}
    </section>
  );
}

/**
 * Only the queues that apply to the signed-in user are rendered. The IMS
 * queue is null, not empty, for anyone without an IMS-admin role — see
 * getApprovalQueues for why status alone cannot decide this.
 */
export default async function ApprovalsPage() {
  const queues = await getApprovalQueues();

  return (
    <div className="flex-1 p-4 md:p-6 space-y-8 w-full max-w-[1400px] mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Document change requests waiting for your decision.
        </p>
      </div>

      <Queue
        title="Owner review"
        hint="Change requests at the owner review stage, for documents you review."
        icon={<Inbox className="h-4 w-4" />}
        stage="owner"
        items={queues.owner}
      />

      {queues.ims !== null && (
        <Queue
          title="IMS review"
          hint="Change requests approved by their owner, awaiting IMS."
          icon={<ShieldCheck className="h-4 w-4" />}
          stage="ims"
          items={queues.ims}
        />
      )}
    </div>
  );
}
