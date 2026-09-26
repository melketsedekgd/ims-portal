import { getWorkflowSettings } from "@/features/documents/queries";
import { getActiveDepartments, getActiveReviewerHolders } from "@/features/admin/queries";
import { getSignoffSettings } from "@/features/signoff/queries";
import ApprovalSettings from "@/features/admin/components/ApprovalSettings";

/**
 * Which steps each approval goes through: document change requests per
 * document type, and quarter sign-off per department (?tab=signoff).
 * admin/layout.tsx has already turned away everyone but IMS admins; RLS on
 * the settings tables says the same for writes.
 *
 * Both tabs' data is fetched whichever is open: the client keeps both tabs
 * mounted so unsaved changes survive switching between them.
 */
export default async function ApprovalSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const [types, departments, holders, signoff] = await Promise.all([
    getWorkflowSettings(),
    getActiveDepartments(),
    getActiveReviewerHolders(),
    getSignoffSettings(),
  ]);

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-[1440px] mx-auto">
      <ApprovalSettings
        tab={tab === "signoff" ? "signoff" : "documents"}
        types={types}
        departments={departments}
        holders={holders}
        signoff={signoff}
      />
    </div>
  );
}
