"use client"

import type { MouseEvent } from "react"
import Image from "next/image"
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

import { LayoutDashboard, Target, BarChart3, ShieldAlert, LogOut, Settings, Building2, Users, CheckCircle2, Inbox, Workflow } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import type { CurrentUser } from "@/features/auth/queries"
import { initials } from "@/lib/initials"
import { isAdmin } from "@/lib/permissions"
import { useUnreadShareCount } from "@/features/shares/use-unread-share-count"
const primaryNav = [
  { title: "Overview",      url: "/department", icon: LayoutDashboard },
  { title: "Objectives",    url: "/department/objectives", icon: Target },
  { title: "KPIs",          url: "/department/kpis", icon: BarChart3 },
  { title: "Risks",         url: "/department/risks", icon: ShieldAlert },
  { title: "Documents",     url: "/department/approvals", icon: CheckCircle2 },
  { title: "Shared",        url: "/shared", icon: Inbox },
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
  {
    title: "Approval settings",
    url: "/admin/approval-settings",
    icon: Workflow,
  },
]

/**
 * One class list for every nav button. Expanded: a 44px full-width row; the
 * active item is a solid coral pill. Collapsed (the 72px rail): a 44px
 * coral rounded square centred in the rail with the icon alone — the label
 * is hidden and the tooltip carries it. Icons are 20px in both modes; the
 * sidebar's own [&_svg]:size-4 is overridden here rather than in the ui
 * component. data-active:hover/active repeat the coral so the ui
 * component's grey hover and press states never show on the active item.
 */
const navButtonClass =
  "h-11 w-full gap-3 rounded-full px-4 text-ink-2 [&_svg]:size-5 hover:bg-white/70 hover:text-ink active:bg-white/80 " +
  "data-active:bg-coral data-active:text-white data-active:shadow-[0_8px_20px_-8px_var(--coral)] " +
  "data-active:hover:bg-coral data-active:hover:text-white data-active:active:bg-coral data-active:active:text-white " +
  "group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-[14px]"

/** Clicks on or inside these keep their own behaviour and never toggle the panel. */
const NO_TOGGLE = 'a, button, input, select, textarea, [role="menuitem"], [role="button"], [data-no-toggle]'

const sectionLabelClass =
  "px-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden"

export function AppSidebar({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname()
  const unreadShares = useUnreadShareCount(user?.id)
  // On phones the sidebar is a sheet over the page: a nav tap closes it
  // as the link navigates, or the new page opens underneath it.
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar()
  const closeOnPhone = () => {
    if (isMobile) setOpenMobile(false)
  }

  const roleName = user?.roles[0]?.name ?? ""

  // Empty panel space toggles the sidebar, through toggleSidebar so the
  // cookie is written as for the button. Mouse only by design: Ctrl/⌘+B and
  // the rail's expand button are the keyboard path, so the panel gets no
  // role or tabIndex.
  const toggleOnEmptySpace = (event: MouseEvent<HTMLDivElement>) => {
    if (isMobile) return
    const target = event.target as Element
    // React bubbles clicks out of portals (tooltips) through the tree.
    if (!event.currentTarget.contains(target)) return
    if (target.closest(NO_TOGGLE)) return
    // Finishing a text selection, e.g. copying the user's name.
    if (window.getSelection()?.toString()) return
    toggleSidebar()
  }

  // Visibility only — admin/layout.tsx is the authorization.
  const showAdmin = isAdmin(user)

  // Dashboard is exact match, sub-routes use startsWith. Actions has no nav
  // item of its own — it is reached from the dashboard card — so it keeps
  // the dashboard lit.
  const isActive = (url: string) => {
    if (url === "/department") return pathname === url || pathname.startsWith("/department/actions")
    if (url === "/admin") return pathname === url
    return pathname.startsWith(url)
  }

  return (
    // The container's own bg-sidebar and right border are cleared so the
    // glass panel inside floats on the shell backdrop; pl-3/py-3 is the gap
    // around it, which is why the layout's widths are panel + 0.75rem. On
    // phones none of this applies: <Sidebar> renders an opaque sheet and the
    // panel fills it edge to edge.
    <Sidebar
      collapsible="icon"
      className="py-3 pl-3 group-data-[side=left]:border-r-0 [&>[data-slot=sidebar-inner]]:bg-transparent"
    >
      <div
        onClick={toggleOnEmptySpace}
        className="glass flex h-full flex-col overflow-hidden rounded-[24px] max-md:rounded-none max-md:border-0 max-md:shadow-none"
      >
        {/* === HEADER: logo ===
            Expanded (and on phones), the sign-in page's logo (same file),
            centred and fitted to the 36px row. It is not a control, so a
            click on it collapses the panel like any empty space. Collapsed,
            the full logo doesn't fit the rail, so only its dotted-C mark
            shows, and the mark is the expand button. */}
        <SidebarHeader className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
            <div className="relative h-9 min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <Image
                src="/mmcy-logo.png"
                alt="MMCY Tech"
                fill
                sizes="160px"
                className="object-contain"
                priority
              />
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="hidden size-9 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:flex"
            >
              <Image src="/icon.png" alt="MMCY Tech" width={36} height={36} className="size-9 rounded-xl" />
            </button>
          </div>
        </SidebarHeader>

        {/* === BODY === */}
        <SidebarContent className="px-3 py-3 space-y-5">

          {/* Primary Nav (Department Workspace) */}
          <div>
            <p className={sectionLabelClass}>Main</p>
            <SidebarMenu className="gap-1">
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
                    // top-1/2! beats the ui component's size-keyed top-1.5,
                    // which sat the pill high on a 44px row. On the active
                    // (coral) row the pill inverts so it stays visible.
                    <SidebarMenuBadge
                      aria-label={`${unreadShares} unread`}
                      className="top-1/2! right-3 -translate-y-1/2 rounded-full bg-coral px-1.5 text-white! text-[11px] peer-data-active/menu-button:bg-white peer-data-active/menu-button:text-coral-600!"
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
              <p className={sectionLabelClass}>Admin</p>
              {/* The label is hidden on the rail; a rule marks the break instead. */}
              <div aria-hidden className="mx-auto mb-3 hidden h-px w-8 bg-ink/10 group-data-[collapsible=icon]:block" />
              <SidebarMenu className="gap-1">
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

        {/* === FOOTER: log out + user card === */}
        <SidebarFooter className="gap-2 border-t border-white/70 px-3 py-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Log out"
                onClick={() => logout()}
                className={navButtonClass}
              >
                <LogOut className="size-5 shrink-0" />
                <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">Log out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <div
            data-no-toggle
            title={user?.fullName}
            className="flex items-center gap-3 rounded-2xl bg-white/55 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-coral-600 text-xs font-semibold text-white">
                {initials(user?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold leading-tight text-ink">
                {user?.fullName ?? "Not signed in"}
              </p>
              <p className="truncate text-xs leading-tight text-muted-foreground">{roleName}</p>
            </div>
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
