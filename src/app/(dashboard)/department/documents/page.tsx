import { redirect } from "next/navigation";

/** The documents register lives on the approvals page; this path only exists so links to it land there. */
export default function DocumentsPage() {
  redirect("/department/approvals");
}
