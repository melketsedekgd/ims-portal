"use client"

import Image from "next/image"
import { useSidebar } from "@/components/ui/sidebar"

export function SidebarHeaderLogo() {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      onClick={toggleSidebar}
      className="flex w-full items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors p-1 outline-none"
    >
      {/* Wide logo — expanded state */}
      <Image
        src="/mmcy-logo.png"
        alt="MMCY Logo"
        width={2510}
        height={583}
        className="w-full h-auto object-contain max-h-10 group-data-[collapsible=icon]:hidden"
        priority
      />

      {/* Round icon — collapsed state, perfect aspect ratio */}
      <Image
        src="/icon.png"
        alt="MMCY Icon"
        width={32}
        height={32}
        className="hidden shrink-0 rounded-full object-cover aspect-square group-data-[collapsible=icon]:block"
      />
    </button>
  )
}