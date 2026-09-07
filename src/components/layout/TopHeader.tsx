"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Bell } from "lucide-react"

export function TopHeader() {
  const pathname = usePathname()
  
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
        {/* Notification Bell */}
        <button 
          className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5" />
          {/* Unread indicator dot */}
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        </button>
      </div>
    </header>
  )
}
