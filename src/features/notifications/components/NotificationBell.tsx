"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Bell } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import type { Enums } from "@/types/database"

import { relativeTime } from "@/lib/relative-time"
import { itemNoun, type ShareItemType } from "@/features/shares/types"

import { NOTIFICATION_LABELS } from "../labels"

const PAGE_SIZE = 10
const POLL_MS = 60_000

type Notification = {
  id: string
  type: Enums<"notification_type">
  subject_id: string
  link: string
  read_at: string | null
  created_at: string
}

type ShareSummary = {
  id: string
  item_type: ShareItemType
  sender: { full_name: string } | null
  share_items: { count: number }[]
}

/**
 * Mounted in TopHeader rather than in a layout on purpose. A layout does not
 * re-render on client navigation, so a count fetched there is read once per
 * full page load and then goes stale — approve something and the badge keeps
 * the old number until a hard refresh.
 */
export function NotificationBell() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const pathname = usePathname()

  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  // share id -> "Josh shared 3 KPIs with you". A share notification whose
  // share has not loaded falls back to the generic label.
  const [shareLines, setShareLines] = useState<Record<string, string>>({})

  const fetchState = useCallback(async () => {
    // No recipient filter anywhere here. RLS scopes notifications to the
    // signed-in user in the database; an .eq("recipient_id", ...) on top of
    // it would turn a broken policy into rows that merely look right.
    const [list, count] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, type, subject_id, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
    ])

    // The only notification whose line names who and how many. RLS lets
    // a recipient read the share it points at.
    const shareIds = (list.data ?? [])
      .filter((n) => n.type === "items_shared")
      .map((n) => n.subject_id)
    let lines: Record<string, string> | null = null
    if (shareIds.length > 0) {
      const shares = await supabase
        .from("shares")
        .select("id, item_type, sender:profiles!shares_sender_id_fkey ( full_name ), share_items ( count )")
        .in("id", shareIds)
        .returns<ShareSummary[]>()
      if (!shares.error) {
        lines = {}
        for (const sh of shares.data ?? []) {
          const n = sh.share_items[0]?.count ?? 0
          lines[sh.id] =
            `${sh.sender?.full_name ?? "Someone"} shared ${n} ${itemNoun(sh.item_type, n)} with you`
        }
      }
    }

    return {
      items: list.error ? null : list.data,
      unread: count.error ? null : count.count ?? 0,
      lines,
    }
  }, [supabase])

  const refresh = useCallback(() => {
    void fetchState().then(({ items: next, unread: count, lines }) => {
      if (next) setItems(next)
      if (lines) setShareLines(lines)
      if (count !== null) setUnread(count)
    })
  }, [fetchState])

  // A new pathname means something may just have happened — an approval, a
  // request raised. Refetch on navigation, on returning to the tab, and on a
  // slow timer for a window left open.
  useEffect(() => {
    refresh()
  }, [refresh, pathname])

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS)
    window.addEventListener("focus", refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])

  async function openNotification(notification: Notification) {
    if (!notification.read_at) {
      // read_at is the only column a client is granted, so this is the only
      // write the bell can make.
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notification.id)
      setUnread((n) => Math.max(0, n - 1))
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      )
    }
    router.push(notification.link)
  }

  // Every unread row, not just the ten on screen: the badge counts rows the
  // dropdown never showed, and clearing only the visible page would leave it
  // stuck at a number the user cannot reach.
  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null)
    refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-4" />
            {unread > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] tabular-nums"
              >
                {unread > 99 ? "99+" : unread}
              </Badge>
            )}
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No notifications
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openNotification(item)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted"
                >
                  <span
                    className={
                      item.read_at
                        ? "text-sm text-muted-foreground"
                        : "text-sm font-medium"
                    }
                  >
                    {(item.type === "items_shared" && shareLines[item.subject_id]) ||
                      NOTIFICATION_LABELS[item.type]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(item.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
