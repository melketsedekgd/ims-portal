"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const POLL_MS = 60_000

/**
 * Unread shares for the sidebar badge. Fetched in the browser and again on
 * every navigation, for the reason NotificationBell gives: a count read in
 * a layout goes stale, and opening a share must take it down by one.
 *
 * The recipient filter is not a permission filter: RLS also shows a sender
 * the recipient rows of what they sent, which are not theirs to read.
 */
export function useUnreadShareCount(userId: string | undefined): number {
  const supabase = useMemo(() => createClient(), [])
  const pathname = usePathname()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    let live = true
    const refresh = () => {
      void supabase
        .from("share_recipients")
        .select("share_id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null)
        .then(({ count: n, error }) => {
          if (live && !error) setCount(n ?? 0)
        })
    }
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    window.addEventListener("focus", refresh)
    return () => {
      live = false
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [supabase, userId, pathname])

  return count
}
