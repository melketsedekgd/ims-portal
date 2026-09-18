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
      <main className="flex-1 w-full flex flex-col">
        <TopHeader />
        {children}
      </main>
    </SidebarProvider>
  );
}