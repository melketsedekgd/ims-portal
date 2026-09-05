"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

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
  LogOut
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {SidebarHeaderLogo} from "@/components/sidebar/sidebar-header-logo"

const primaryNav = [
  { title: "Dashboard",     url: "/department", icon: LayoutDashboard },
  { title: "Objectives",    url: "/department/objectives", icon: Target },
  { title: "KPI Tracking",  url: "/department/kpis", icon: BarChart3 },
  { title: "Risk Register", url: "/department/risks", icon: ShieldAlert },
  { title: "Reports",       url: "/department/reports", icon: FileBarChart },
]

const mockUser = {
  name: "Nahom",
  role: "Frontend Lead",
  avatar: "https://github.com/shadcn.png",
  initials: "NA",
}

export function AppSidebar() {
  const pathname = usePathname()

  // Dashboard is exact match, sub-routes use startsWith
  const isActive = (url: string) => {
    if (url === "/department") return pathname === "/department"
    return pathname.startsWith(url)
  }

  return (
    <Sidebar collapsible="icon">
      {/* === HEADER === */}
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
  <SidebarHeaderLogo />
</SidebarHeader>

      {/* === BODY === */}
      <SidebarContent className="px-3 py-4">

        {/* Primary Nav */}
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

      </SidebarContent>

      {/* === FOOTER === */}
      <SidebarFooter className="border-t border-sidebar-border px-3 py-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left outline-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
            
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-8 w-8 shrink-0 rounded-full border border-sidebar-border">
                <AvatarImage src={mockUser.avatar} alt={mockUser.name} />
                <AvatarFallback className="rounded-full bg-primary/10 text-primary text-xs">{mockUser.initials}</AvatarFallback>
              </Avatar>
              
              {/* Hidden when collapsed */}
              <div className="flex flex-col items-start justify-center overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="truncate w-full font-semibold text-sm leading-tight text-foreground">{mockUser.name}</span>
                <span className="truncate w-full text-xs leading-tight text-muted-foreground">{mockUser.role}</span>
              </div>
            </div>
            
            {/* Hidden when collapsed */}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/70 group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          
          <DropdownMenuContent side="top" align="center" className="w-56 rounded-lg">
            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer font-medium">
              <LogOut className="mr-2 size-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
