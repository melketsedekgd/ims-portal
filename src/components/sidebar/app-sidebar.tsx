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
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { LayoutDashboard, Target, BarChart3, ShieldAlert, ChevronsUpDown, LogOut, Settings, Building2, Users, CheckCircle2, ListChecks, Inbox } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarHeaderLogo } from "@/components/sidebar/sidebar-header-logo"

import type { CurrentUser } from "@/features/auth/queries"
import { isAdmin } from "@/lib/permissions"
import { useUnreadShareCount } from "@/features/shares/use-unread-share-count"
const primaryNav = [
  { title: "Overview",      url: "/department", icon: LayoutDashboard },
  { title: "Objectives",    url: "/department/objectives", icon: Target },
  { title: "KPI Tracking",  url: "/department/kpis", icon: BarChart3 },
  { title: "Risk Register", url: "/department/risks", icon: ShieldAlert },
  { title: "Actions",       url: "/department/actions", icon: ListChecks },
  { title: "Documents",     url: "/department/approvals", icon: CheckCircle2 },
  { title: "Shared with you", url: "/shared", icon: Inbox },
]

const adminNav = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: Settings,
  },
  {
    title: "Departments",
    url: "/admin/departments",
    icon: Building2,
  },
  {
    title: "Users & Roles",
    url: "/admin/users",
    icon: Users,
  },
]

/**
 * One class list for every nav button. Expanded: a full-width row with a
 * coral bar on the active item. Collapsed (the 4rem rail): a 40px square
 * centred in the rail with the icon alone — the label is hidden and the
 * tooltip carries it — and the active slate background still shows; only
 * the coral bar is dropped. Icons are 20px in both modes; the sidebar's
 * own [&_svg]:size-4 is overridden here rather than in the ui component.
 */
const navButtonClass =
  "relative w-full px-3 py-2 [&_svg]:size-5 " +
  "data-active:before:absolute data-active:before:left-0 data-active:before:top-1.5 data-active:before:bottom-1.5 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-coral " +
  "group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:data-active:before:hidden"

export function AppSidebar({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname()
  const unreadShares = useUnreadShareCount(user?.id)
  // On phones the sidebar is a sheet over the page: a nav tap closes it
  // as the link navigates, or the new page opens underneath it.
  const { isMobile, setOpenMobile } = useSidebar()
  const closeOnPhone = () => {
    if (isMobile) setOpenMobile(false)
  }

  const initials = user?.fullName
    ?.split(" ")
    ?.map((part: string) => part[0])
    ?.slice(0, 2)
    ?.join("")
    ?.toUpperCase() ?? "?"

  const subtitle = user
    ? [user.roles?.[0]?.name, user.roles?.[0]?.departmentCode].filter(Boolean).join(" · ")
    : ""

  // Visibility only — admin/layout.tsx is the authorization.
  const showAdmin = isAdmin(user)

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
          <p className="px-3 text-xs font-medium text-muted-foreground mb-2 group-data-[collapsible=icon]:hidden">
            Workspace
          </p>
          <SidebarMenu className="gap-0.5">
            {primaryNav.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  render={<Link href={item.url} />} 
                  tooltip={item.title} 
                  isActive={isActive(item.url)} 
                  className={navButtonClass}
                  onClick={closeOnPhone}
                >
                  <item.icon className="size-5 shrink-0" />
                  <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                </SidebarMenuButton>
                {item.url === "/shared" && unreadShares > 0 && (
                  <SidebarMenuBadge
                    aria-label={`${unreadShares} unread`}
                    className="top-1/2 right-2 -translate-y-1/2 rounded-full bg-ink text-white! text-[11px]"
                  >
                    {unreadShares > 99 ? "99+" : unreadShares}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {/* Admin Nav (System Administration) */}
        {showAdmin && (
          <div>
            <p className="px-3 text-xs font-medium text-muted-foreground mb-2 group-data-[collapsible=icon]:hidden">
              Administration
            </p>
            <SidebarMenu className="gap-0.5">
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    render={<Link href={item.url} />} 
                    tooltip={item.title} 
                    isActive={isActive(item.url)} 
                    className={navButtonClass}
                    onClick={closeOnPhone}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
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