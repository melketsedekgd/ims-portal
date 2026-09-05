"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { logout } from "@/features/auth/mutations"

import {
  Sidebar,
  SidebarContent,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,  
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { 
  LayoutDashboard, 
  Target, 
  BarChart3, 
  ShieldAlert,
  FileBarChart,
  ChevronsUpDown, 
  LogOut,
  Settings,
  Building2,
  Users
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarHeaderLogo } from "@/components/sidebar/sidebar-header-logo"

import type { CurrentUser } from "@/features/auth/queries"
const primaryNav = [
  { title: "Dashboard",     url: "/department", icon: LayoutDashboard },
  { title: "Objectives",    url: "/department/objectives", icon: Target },
  { title: "KPI Tracking",  url: "/department/kpis", icon: BarChart3 },
  { title: "Risk Register", url: "/department/risks", icon: ShieldAlert },
  { title: "Reports",       url: "/department/reports", icon: FileBarChart },
]

const adminNav = [
  { title: "Admin Dashboard", url: "/admin", icon: Settings },
  { title: "Departments",     url: "/admin/departments", icon: Building2 },
  { title: "Users & Roles",   url: "/admin/users", icon: Users },
]

export function AppSidebar({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname()

  const initials = user?.fullName
    ?.split(" ")
    ?.map((part: string) => part[0])
    ?.slice(0, 2)
    ?.join("")
    ?.toUpperCase() ?? "?"

  const subtitle = user
    ? [user.roles?.[0]?.name, user.roles?.[0]?.departmentCode].filter(Boolean).join(" · ")
    : ""

  // Admin module is gated on the system_admin role from the roles catalogue
  const isSystemAdmin = user?.roles?.some((r) => r.key === "system_admin") ?? false

  // Dashboard is exact match, sub-routes use startsWith
  const isActive = (url: string) => {
    if (url === "/department" || url === "/admin") return pathname === url
    return pathname.startsWith(url)
  }

  return (
    <Sidebar collapsible="icon">
      {/* === HEADER === */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <SidebarHeaderLogo />
      </SidebarHeader>

      {/* === BODY === */}
      <SidebarContent className="px-3 py-4 space-y-6">

        {/* Primary Nav (Department Workspace) */}
        <div>
          <p className="px-3 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider group-data-[collapsible=icon]:hidden">
            Workspace
          </p>
          <ul className="flex flex-col gap-0.5">
            {primaryNav.map((item) => (
              <li key={item.title}>
                <Link href={item.url}>
                  <SidebarMenuButton isActive={isActive(item.url)} className="w-full px-3 py-2">
                    <item.icon className="size-4 shrink-0" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </SidebarMenuButton>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Admin Nav (System Administration) */}
        {isSystemAdmin && (
          <div>
            <p className="px-3 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider group-data-[collapsible=icon]:hidden">
              Administration
            </p>
            <ul className="flex flex-col gap-0.5">
              {adminNav.map((item) => (
                <li key={item.title}>
                  <Link href={item.url}>
                    <SidebarMenuButton isActive={isActive(item.url)} className="w-full px-3 py-2">
                      <item.icon className="size-4 shrink-0" />
                      <span className="text-sm font-medium">{item.title}</span>
                    </SidebarMenuButton>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

      </SidebarContent>

      {/* === FOOTER === */}
      <SidebarFooter className="border-t border-sidebar-border px-3 py-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left outline-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
            
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-8 w-8 shrink-0 rounded-full border border-sidebar-border">
                <AvatarFallback className="rounded-full bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
              </Avatar>
              
              {/* Hidden when collapsed */}
              <div className="flex flex-col items-start justify-center overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="truncate w-full font-semibold text-sm leading-tight text-foreground">
                  {user?.fullName ?? "Not signed in"}
                </span>
                <span className="truncate w-full text-xs leading-tight text-muted-foreground">
                  {subtitle}
                </span>
              </div>
            </div>
            
            {/* Hidden when collapsed */}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/70 group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          
          <DropdownMenuContent side="top" align="center" className="w-56 rounded-lg">
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer font-medium"
            >
              <LogOut className="mr-2 size-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}