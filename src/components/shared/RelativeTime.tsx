"use client"

import { relativeTime } from "@/lib/relative-time"

/**
 * "3 minutes ago" for a server-rendered page. The server's clock and the
 * browser's disagree by the time it takes to arrive, so the text is
 * allowed to differ at hydration; the full date is in the tooltip.
 */
export default function RelativeTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} suppressHydrationWarning>
      {relativeTime(iso)}
    </time>
  )
}
