import { RowSelectionProvider } from "@/components/shared/RowSelection";

// Holds the list's ticked rows. A layout, so the selection outlives the
// list remounting on a period or department change; see RowSelection.tsx.
export default function SelectionLayout({ children }: { children: React.ReactNode }) {
  return <RowSelectionProvider>{children}</RowSelectionProvider>;
}
