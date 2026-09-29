import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DASHBOARD_CHART_AREA } from "@/components/dashboard/TrendCharts"
import { cn } from "@/lib/utils"

/**
 * The frame the dashboard's list cards share: a title with a summary on its
 * right, a one-line subtitle, and a list over a footer.
 *
 * The list and footer live in DASHBOARD_CHART_AREA, the box the Risk scores
 * chart draws in, so the cards keep the row's height whatever they hold.
 * The list clips rather than growing the card.
 */
export function DashboardListCard({
  title,
  description,
  summary,
  empty,
  footer,
  children,
}: {
  title: string
  description: string
  /** Top-right counts, already coloured. */
  summary?: React.ReactNode
  /** Shown in place of the list and footer when there is nothing to list. */
  empty?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="font-semibold text-ink">{title}</CardTitle>
          {summary && <div className="flex shrink-0 gap-2.5 text-xs font-bold">{summary}</div>}
        </div>
        <CardDescription className="min-w-0 truncate text-ink/70" title={description}>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className={cn(DASHBOARD_CHART_AREA, "flex flex-col")}>
          {empty ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-ink/70">
              {empty}
            </div>
          ) : (
            <>
              <ul className="min-h-0 flex-1 overflow-hidden">{children}</ul>
              <div className="flex items-center justify-between gap-3 border-t border-ink/8 pt-2 text-xs leading-4 text-ink/70">
                {footer}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
