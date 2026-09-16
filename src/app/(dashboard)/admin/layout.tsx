import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin } from "@/lib/permissions";

/**
 * Authorization for every /admin route. proxy.ts only checks that someone
 * is signed in; this decides whether they belong here. IMS administers the
 * system; everyone else — department managers included — is sent back to
 * their workspace.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/department");
  return <>{children}</>;
}
