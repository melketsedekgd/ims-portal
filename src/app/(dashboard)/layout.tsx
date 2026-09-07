import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TopHeader } from "@/components/layout/TopHeader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 w-full flex flex-col">
        <TopHeader />
        {children}
      </main>
    </SidebarProvider>
  );
}