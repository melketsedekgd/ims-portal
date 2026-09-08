import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { getCurrentUser } from "@/features/auth/queries";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <main className="flex-1 w-full flex flex-col">
        <TopHeader />
        {children}
      </main>
    </SidebarProvider>
  );
}