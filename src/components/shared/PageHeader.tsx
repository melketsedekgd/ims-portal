/**
 * The one page header. Title in ink, description muted, actions on the
 * right; no title icons. Server-renderable — it holds nothing.
 */
export default function PageHeader({
  title,
  description,
  actions,
  beside,
  below,
}: {
  title: string
  description?: React.ReactNode
  /** Right-hand controls: pickers, primary buttons. */
  actions?: React.ReactNode
  /** Something that sits beside the title on the same line, like a badge. */
  beside?: React.ReactNode
  /**
   * A second row of controls under the actions, right-aligned beneath them.
   * For controls that are not navigation — the sign-off buttons, which
   * change the quarter rather than change what you are looking at. Wraps on
   * narrow screens and stays right-aligned.
   */
  below?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {beside}
          </div>
          {/* With no `below` row to share, the description stays in the title
              column, where it still comes before the actions when they stack
              on a narrow screen. Every caller but the dashboard is this one. */}
          {description && !below && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* The description and the second row of controls share a line rather
          than taking one each: the controls are right-aligned and the
          description is short, so a row of its own left a band of empty space
          across the header.

          ml-auto rather than justify-between so the controls stay right-
          aligned when they wrap onto their own line. empty:hidden because
          `below` is an element even when it renders nothing — SignoffActions
          returns null whenever it is nobody's turn. */}
      {below && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          {description && (
            <p className="min-w-0 text-sm text-muted-foreground">{description}</p>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2 empty:hidden">
            {below}
          </div>
        </div>
      )}
    </div>
  )
}
