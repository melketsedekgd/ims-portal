import { cookies } from "next/headers";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { getCurrentUser } from "@/features/auth/queries";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // SidebarProvider writes sidebar_state on every toggle. Reading it here
  // renders the right width on the server, so a collapsed rail never flashes
  // open before hydration. No cookie (first visit) means expanded.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <>
      <div aria-hidden className="shell-backdrop" />
      {/* Widths are the glass panel (248px expanded, 72px rail) plus the
          0.75rem gutter AppSidebar pads around it. */}
      <SidebarProvider
        defaultOpen={sidebarOpen}
        style={{ "--sidebar-width": "16.25rem", "--sidebar-width-icon": "5.25rem" } as React.CSSProperties}
      >
        <AppSidebar user={user} />
        {/* min-w-0: a flex item defaults to min-width:auto, so a wide table
            grew main past the viewport and the whole page scrolled sideways.
            Wide tables scroll inside their own container instead. */}
        <main className="flex-1 w-full min-w-0 flex flex-col">
          <TopHeader />
          {children}
        </main>
      </SidebarProvider>
    </>
  );
}