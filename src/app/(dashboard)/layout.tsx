import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { getCurrentUser } from "@/features/auth/queries";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    // Collapsed rail is 4rem, not shadcn's 3rem: 40px buttons with 20px
    // icons need the room. Expanded width stays the default 16rem.
    <SidebarProvider style={{ "--sidebar-width-icon": "4rem" } as React.CSSProperties}>
      <AppSidebar user={user} />
      {/* min-w-0: a flex item defaults to min-width:auto, so a wide table
          grew main past the viewport and the whole page scrolled sideways.
          Wide tables scroll inside their own container instead. */}
      <main className="flex-1 w-full min-w-0 flex flex-col">
        <TopHeader />
        {children}
      </main>
    </SidebarProvider>
  );
}