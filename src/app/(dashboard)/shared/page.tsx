import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import RelativeTime from "@/components/shared/RelativeTime";
import { getCurrentUser } from "@/features/auth/queries";
import { getReceivedShares } from "@/features/shares/queries";
import { itemNoun } from "@/features/shares/types";

export default async function SharedWithYouPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const shares = await getReceivedShares(user.id);

  return (
    <div className="flex-1 space-y-6 w-full max-w-[1100px] mx-auto p-4 md:p-6">
      <PageHeader
        title="Shared with you"
        description="KPIs and risks people have sent you. You see only the items your own access allows."
      />

      {shares.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-muted-foreground dark:border-slate-800">
          <Inbox className="h-5 w-5" />
          Nothing has been shared with you yet.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {shares.map((s) => (
            <li key={s.id}>
              <Link
                href={`/shared/${s.id}`}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <span
                  aria-hidden
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${s.unread ? "bg-coral" : "bg-transparent"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={s.unread ? "font-semibold text-ink" : "text-ink-2"}>
                      {s.senderName}
                    </span>
                    <span className={`text-sm ${s.unread ? "font-semibold" : "text-muted-foreground"}`}>
                      {s.itemCount} {itemNoun(s.itemType, s.itemCount)}
                    </span>
                    <span className="text-sm text-muted-foreground">· {s.period}</span>
                    {s.unread && <span className="sr-only">(unread)</span>}
                  </div>
                  {s.note && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {s.note.split("\n")[0]}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <RelativeTime iso={s.createdAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
