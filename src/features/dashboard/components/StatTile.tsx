import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { PILL } from "@/components/shared/status-styles"
import { cn } from "@/lib/utils"
import { DASH_TONE } from "@/features/dashboard/status"

/** The status pill's colours: the dashboard's status tokens, and ink's tint. */
export const TILE_TONE = {
  good: DASH_TONE.good,
  warn: DASH_TONE.warn,
  bad: DASH_TONE.bad,
  neutral: DASH_TONE.inHand,
} as const

export type TileTone = keyof typeof TILE_TONE

/** A pill in one of the tile tones, for the top-right slot or the row under the label. */
export function TilePill({
  tone,
  children,
}: {
  tone: TileTone
  children: React.ReactNode
}) {
  return <span className={cn(PILL, TILE_TONE[tone])}>{children}</span>
}

/**
 * One headline number on a glass card.
 *
 * Presentation only: every value, label and pill arrives already computed
 * and already worded by the caller. `status` is for a status or count the
 * tile showed before this component existed — it is not a place to add a
 * comparison nobody computed.
 */
export function StatTile({
  icon: Icon,
  value,
  label,
  detail,
  status,
  children,
}: {
  icon: LucideIcon
  value: React.ReactNode
  label: string
  detail?: React.ReactNode
  /** Top-right pill. */
  status?: React.ReactNode
  /** Extra pills under the label. */
  children?: React.ReactNode
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-coral-tint text-coral-600">
          <Icon className="size-[18px]" aria-hidden />
        </div>
        {status}
      </div>
      <div className="mt-4 text-3xl font-bold leading-none tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      {children && <div className="mt-3 flex flex-wrap items-center gap-1.5">{children}</div>}
    </Card>
  )
}
