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
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {/* empty:hidden because `below` is an element even when it renders
          nothing — SignoffActions returns null whenever it is nobody's turn,
          and without this the row would still reserve its margin. */}
      {below && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 empty:hidden empty:mt-0">
          {below}
        </div>
      )}
    </div>
  )
}
