"use client"

import { useRef } from "react"
import Link from "next/link"
import { Lock } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import ColumnsBar from "@/components/shared/ColumnsBar"
import ListPagination, { usePagination } from "@/components/shared/ListPagination"
import { SHARED_COLUMNS } from "@/features/shares/columns"
import type { ShareItemType } from "@/features/shares/types"
import { useColumnChoice } from "@/features/table-preferences/components/ColumnChoiceProvider"

/**
 * The shared items, in the export's columns, so the page and a file of
 * the same items say the same thing. The rows carry every column; the
 * viewer's choice decides which are shown. Process leads and is always
 * shown, as in every export.
 *
 * `hiddenCount` is only a number. Which items they are, and their names,
 * never reach this page: the rows came back through the viewer's RLS.
 */
export default function SharedItemsTable({
  itemType,
  headers,
  rows,
  linkKey,
  hiddenCount,
}: {
  itemType: ShareItemType
  /** Every column the rows carry, key → header, in file order. */
  headers: Record<string, string>
  rows: { id: string; href: string; values: Record<string, string> }[]
  /** The column whose cell links to the item's own page. */
  linkKey: string
  hiddenCount: number
}) {
  const registry = SHARED_COLUMNS[itemType]
  const { keys: columns, set: setColumns, reset: resetColumns } = useColumnChoice(registry)
  const shown = ["process", ...registry.columns.filter((c) => columns.includes(c.key)).map((c) => c.key)]
    .filter((key) => key in headers)

  // Nothing narrows the list, so nothing sends it back to page 1.
  const pager = usePagination(rows.length, "")
  const cardRef = useRef<HTMLDivElement>(null)
  // The inaccessible items are counted once, under the last page.
  const lastPage = pager.page === pager.pageCount

  return (
    <div ref={cardRef} className="rounded-xl border bg-card overflow-hidden">
      <ColumnsBar
        registry={registry}
        keys={columns}
        listed={() => true}
        onChange={setColumns}
        onReset={resetColumns}
      />
      <Table>
        <TableHeader>
          <TableRow>
            {shown.map((key) => (
              <TableHead key={key}>{headers[key]}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(pager.start, pager.end).map((row) => (
            <TableRow key={row.id}>
              {shown.map((key) => (
                <TableCell key={key} className={key === linkKey ? "max-w-[420px] whitespace-normal" : undefined}>
                  {key === linkKey ? (
                    <Link href={row.href} className="font-medium text-ink hover:underline">
                      {row.values[key]}
                    </Link>
                  ) : (
                    row.values[key]
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {hiddenCount > 0 && lastPage && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={shown.length} className="text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {hiddenCount} more {hiddenCount === 1 ? "item" : "items"} you don&apos;t have access to
                </span>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <ListPagination pager={pager} scrollTarget={cardRef} />
    </div>
  )
}
