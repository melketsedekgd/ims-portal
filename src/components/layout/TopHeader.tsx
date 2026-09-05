"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Bell } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function TopHeader() {
  const pathname = usePathname()
  
  // ── Mock Notifications State ──
  const [notifications, setNotifications] = useState([
    { id: 1, title: "KPI Target Modified", description: "Sarah Mengistu updated the System Uptime KPI baseline.", time: "10m ago", read: false },
    { id: 2, title: "Action Required", description: "Q1 2026 Compliance Report requires your signature in 3 days.", time: "2h ago", read: false },
    { id: 3, title: "Risk Escalation", description: "Core Router Failure risk level was escalated to Critical.", time: "5h ago", read: false },
  ])

  // Do not render the top header on authentication pages
  if (pathname.startsWith("/auth")) {
    return null;
  }

  // Split path into segments: "/department/objectives/sub" -> ["department", "objectives", "sub"]
  const pathSegments = pathname.split('/').filter(Boolean)

  // Build the breadcrumb items dynamically, skipping the "department" root
  const breadcrumbItems: { label: string, href: string }[] = []
  
  if (pathname === '/' || pathname === '/department') {
    breadcrumbItems.push({ label: 'Dashboard', href: '/department' })
  } else {
    let currentPath = ''
    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`
      
      // Skip the department base prefix in the UI
      if (segment === 'department') return

      // Format the label nicely
      let label = segment.charAt(0).toUpperCase() + segment.slice(1)
      if (segment.toLowerCase() === 'kpis') label = 'KPI Tracking'
      if (segment.toLowerCase() === 'risks') label = 'Risk Register'

      breadcrumbItems.push({ label, href: currentPath })
    })
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b bg-white px-6 shadow-sm dark:bg-zinc-950 dark:border-zinc-800">
      {/* ── Dynamic Breadcrumb Navigation ── */}
      <nav className="flex items-center text-sm font-medium text-muted-foreground">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1
          return (
            <div key={item.href} className="flex items-center">
              {index > 0 && <ChevronRight className="h-4 w-4 mx-1 opacity-50" />}
              {isLast ? (
                <span className="text-foreground">{item.label}</span>
              ) : (
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Right Side Actions ── */}
      <div className="flex items-center gap-4">
        {/* Notification Bell Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger 
            className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-muted-foreground hover:text-foreground outline-none"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
            {/* Unread indicator dot */}
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 border-2 border-white dark:border-zinc-950"></span>
              </span>
            )}
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-[360px] rounded-lg shadow-lg border-slate-200 dark:border-zinc-800 p-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-800/50">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                  className="text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 font-medium cursor-pointer transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>
            
            {/* Notification List */}
            <div className="max-h-[350px] overflow-y-auto">
              {unreadCount === 0 ? (
                <div className="px-4 py-12 text-center flex flex-col items-center justify-center">
                  <p className="font-medium text-sm text-slate-500 dark:text-slate-400">No unread notifications</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.filter(n => !n.read).map((notif) => (
                    <DropdownMenuItem 
                      key={notif.id} 
                      className="flex items-start gap-3 p-4 border-b last:border-0 border-slate-100 dark:border-zinc-800/50 cursor-pointer rounded-none focus:bg-slate-50 dark:focus:bg-zinc-900/50"
                    >
                      <div className="mt-1 shrink-0">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-500"></span>
                      </div>
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{notif.title}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{notif.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">{notif.description}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-slate-100 dark:border-zinc-800/50 bg-slate-50/50 dark:bg-zinc-900/20 text-center">
              <button className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 w-full py-1.5 cursor-pointer transition-colors">
                View all activity
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
