import { getWorkflowSettings } from "@/features/documents/queries";
import { getActiveDepartments } from "@/features/admin/queries";
import ApprovalSettings from "@/features/admin/components/ApprovalSettings";

/**
 * Which steps a document change request goes through, per document type.
 * admin/layout.tsx has already turned away everyone but IMS admins; RLS on
 * the settings tables says the same for writes.
 */
export default async function ApprovalSettingsPage() {
  const [types, departments] = await Promise.all([getWorkflowSettings(), getActiveDepartments()]);

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-[1440px] mx-auto">
      <ApprovalSettings types={types} departments={departments} />
    </div>
  );
}
