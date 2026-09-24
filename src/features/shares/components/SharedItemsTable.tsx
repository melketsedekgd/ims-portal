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

/**
 * The shared items, in the export's columns, so the page and a file of
 * the same items say the same thing. Server-renderable.
 *
 * `hiddenCount` is only a number. Which items they are, and their names,
 * never reach this page: the rows came back through the viewer's RLS.
 */
export default function SharedItemsTable({
  headers,
  rows,
  linkColumn,
  hiddenCount,
}: {
  headers: string[]
  rows: { id: string; href: string; cells: string[] }[]
  /** Index of the cell that links to the item's own page. */
  linkColumn: number
  hiddenCount: number
}) {
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, i) => (
                <TableCell key={i} className={i === linkColumn ? "max-w-[420px] whitespace-normal" : undefined}>
                  {i === linkColumn ? (
                    <Link href={row.href} className="font-medium text-ink hover:underline">
                      {cell}
                    </Link>
                  ) : (
                    cell
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {hiddenCount > 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={headers.length} className="text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {hiddenCount} more {hiddenCount === 1 ? "item" : "items"} you don&apos;t have access to
                </span>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
