/**
 * The one page header. Title in ink, description muted, actions on the
 * right; no title icons. Server-renderable — it holds nothing.
 */
export default function PageHeader({
  title,
  description,
  actions,
  beside,
}: {
  title: string
  description?: React.ReactNode
  /** Right-hand controls: pickers, primary buttons. */
  actions?: React.ReactNode
  /** Something that sits beside the title on the same line, like a badge. */
  beside?: React.ReactNode
}) {
  return (
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
  )
}
