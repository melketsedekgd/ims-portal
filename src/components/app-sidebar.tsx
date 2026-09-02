import Image from "next/image"
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,  
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { 
  Home, 
  CheckSquare, 
  Layers, 
  Clock,
  ChevronsUpDown, 
  LogOut
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const primaryNav = [
  { title: "Home", url: "#", icon: Home, isActive: true },
  { title: "My store", url: "#", icon: CheckSquare },
  { title: "My projects", url: "#", icon: Layers },
  { title: "Scheduled", url: "#", icon: Clock },
]

const mockUser = {
  name: "Nahom",
  role: "Frontend Lead",
  avatar: "https://github.com/shadcn.png", // Standard placeholder image
  initials: "NA",
}

export function AppSidebar() {
  return (
    <Sidebar>
      {/* === HEADER === */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <a href="/" className="flex w-full items-center justify-start rounded-md hover:bg-sidebar-accent transition-colors">
          <Image 
            src="/mmcy-logo.png" 
            alt="MMCY Logo" 
            width={2510} 
            height={583} 
            className="w-full h-auto object-contain max-h-12"
            priority
          />
        </a>
      </SidebarHeader>

      {/* === BODY === */}
      <SidebarContent className="px-3 py-4">

        {/* Primary Nav — no wrapper padding, full pixel control */}
        <ul className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <li key={item.title}>
              <SidebarMenuButton asChild isActive={item.isActive}>
                <a href={item.url} className="flex items-center gap-3 w-full px-3 py-2 rounded-md">
                  <item.icon className="size-4 shrink-0" />
                  <span className="text-sm font-medium">{item.title}</span>
                </a>
              </SidebarMenuButton>
            </li>
          ))}
        </ul>

      </SidebarContent>

      {/* === FOOTER === */}
      <SidebarFooter className="border-t border-sidebar-border px-3 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left outline-none">
              
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-8 w-8 shrink-0 rounded-full border border-sidebar-border">
                  <AvatarImage src={mockUser.avatar} alt={mockUser.name} />
                  <AvatarFallback className="rounded-full bg-primary/10 text-primary text-xs">{mockUser.initials}</AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col items-start justify-center overflow-hidden">
                  <span className="truncate w-full font-semibold text-sm leading-tight text-foreground">{mockUser.name}</span>
                  <span className="truncate w-full text-xs leading-tight text-muted-foreground">{mockUser.role}</span>
                </div>
              </div>
              
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/70" />
            </button>
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
