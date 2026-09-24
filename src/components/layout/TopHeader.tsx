"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { NotificationBell } from "@/features/notifications/components/NotificationBell"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A detail route's id segment reads as the entity, never as the UUID.
const ENTITY: Record<string, string> = {
  kpis: "KPI",
  risks: "Risk",
  objectives: "Objective",
  documents: "Document",
  shared: "Share",
}

const SECTION: Record<string, string> = {
  kpis: "KPI Tracking",
  risks: "Risk Register",
  objectives: "Objectives",
  documents: "Documents",
  approvals: "Approvals",
  shared: "Shared with you",
  admin: "Administration",
  new: "New",
}

function segmentLabel(segment: string, parent: string | undefined): string {
  if (UUID.test(segment) && parent && ENTITY[parent]) return ENTITY[parent]
  return SECTION[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1)
}

export function TopHeader() {
  const pathname = usePathname()
  const { openMobile, setOpenMobile } = useSidebar()
  
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
    pathSegments.forEach((segment, i) => {
      currentPath += `/${segment}`
      
      // Skip the department base prefix in the UI
      if (segment === 'department') return

      breadcrumbItems.push({ label: segmentLabel(segment, pathSegments[i - 1]), href: currentPath })
    })
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center border-b border-slate-200 bg-white px-6">
      {/* ── Menu (phones) ──
          Below md the sidebar is a closed sheet and its logo toggle goes
          with it, so this is the only way in. md:hidden is the same
          768px line as useIsMobile(), and is right from the server
          render, before the hook has run. Same ghost 32px button as the
          bell; the ::before takes the tap area to 44px. */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        aria-expanded={openMobile}
        onClick={() => setOpenMobile(true)}
        className="relative -ml-2 mr-2 before:absolute before:-inset-1.5 before:content-[''] md:hidden"
      >
        <Menu className="size-4" />
      </Button>

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

      <div className="ml-auto flex items-center">
        <NotificationBell />
      </div>
    </header>
  )
}
