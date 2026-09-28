import Link from "next/link"
import {
  actionSourceHref,
  ITEM_TYPE_LABEL,
  type ActionSourceInfo,
} from "@/features/action-items/sources"

/**
 * "Risk · Email threat …" — the type and the item's name, linked to the
 * item's page when there is one. Unresolved sources (a stale id, or a
 * source this user cannot read) show the type alone, never a blank.
 */
export function RelatedItemLink({
  source,
  fallbackType,
  className = "",
}: {
  source: ActionSourceInfo | null
  /** Shown when the view returned nothing for this action. */
  fallbackType: string
  className?: string
}) {
  const type = source?.itemType ? ITEM_TYPE_LABEL[source.itemType] : fallbackType
  const label = source?.itemLabel ?? null
  const text = label ? `${type} · ${label}` : type
  const href = source ? actionSourceHref(source) : null

  if (!href) {
    return (
      <span className={`block truncate ${className}`} title={text}>
        {text}
      </span>
    )
  }
  return (
    <Link href={href} className={`block truncate text-ink hover:underline ${className}`} title={text}>
      {text}
    </Link>
  )
}
