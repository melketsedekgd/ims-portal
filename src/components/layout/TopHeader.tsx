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

  // Split path into segments: "/department/objectives" -> ["department", "objectives"]
  const pathSegments = pathname.split('/').filter(segment => segment !== '')

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b bg-white px-6 shadow-sm dark:bg-zinc-950 dark:border-zinc-800">
      {/* ── Dynamic Breadcrumb Navigation ── */}
      <nav className="flex items-center text-sm font-medium text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        
        {pathSegments.map((segment, index) => {
          const href = `/${pathSegments.slice(0, index + 1).join('/')}`
          const isLast = index === pathSegments.length - 1
          
          // Format text: "department" -> "Department"
          const formattedSegment = segment.charAt(0).toUpperCase() + segment.slice(1)
          
          return (
            <div key={href} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-1 opacity-50" />
              {isLast ? (
                <span className="text-foreground">{formattedSegment}</span>
              ) : (
                <Link href={href} className="hover:text-foreground transition-colors">
                  {formattedSegment}
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
