"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import Choice from "./Choice"
import type { WorkbookRead } from "../parse"

/** Step 2: which sheet, and which row holds its headers. */
export default function HeaderRowStep({
  fileName,
  read,
  pending,
  onChange,
  onBack,
  onContinue,
}: {
  fileName: string
  read: WorkbookRead
  pending: boolean
  /** Re-reads the file for this sheet and header row. */
  onChange: (sheet: string, headerRow?: number) => void
  onBack: () => void
  onContinue: () => void
}) {
  // Typed separately so a half-typed "1" on the way to "12" doesn't re-read.
  const [typed, setTyped] = useState(String(read.headerRow))
  const width = Math.max(1, ...read.top.map((r) => r.length))

  const applyTyped = () => {
    const n = Number(typed)
    if (Number.isInteger(n) && n >= 1 && n !== read.headerRow) onChange(read.sheet, n)
    else setTyped(String(read.headerRow))
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] items-end">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="import-sheet">Sheet in {fileName}</Label>
          <Choice
            id="import-sheet"
            value={read.sheet}
            onChange={(s) => onChange(s)}
            items={read.sheets.map((s) => ({ value: s, label: s }))}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="import-header-row">Header row</Label>
          <Input
            id="import-header-row"
            type="number"
            min={1}
            value={typed}
            disabled={pending}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={applyTyped}
            onKeyDown={(e) => e.key === "Enter" && applyTyped()}
            className="bg-white dark:bg-slate-950"
          />
        </div>
        <p className="text-sm text-muted-foreground pb-1.5">
          {read.headerRow === read.suggestedHeaderRow
            ? "Row guessed from the sheet. Click another row to change it."
            : `Suggested: row ${read.suggestedHeaderRow}.`}{" "}
          {read.dataRowCount} row{read.dataRowCount === 1 ? "" : "s"} below it.
        </p>
      </div>

      <div className="rounded-lg border overflow-auto max-h-[480px] bg-white dark:bg-slate-950">
        <table className="text-xs w-max min-w-full">
          <tbody>
            {read.top.map((row, i) => {
              const n = i + 1
              const isHeader = n === read.headerRow
              return (
                <tr
                  key={n}
                  onClick={() => {
                    if (pending || isHeader) return
                    setTyped(String(n))
                    onChange(read.sheet, n)
                  }}
                  className={cn(
                    "border-b last:border-0 cursor-pointer",
                    isHeader
                      ? "bg-ink/5 font-semibold"
                      : n < read.headerRow
                        ? "text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-900"
                        : "hover:bg-slate-50 dark:hover:bg-slate-900"
                  )}
                >
                  <td className="sticky left-0 bg-inherit px-2 py-1.5 font-mono text-muted-foreground border-r text-right w-10">
                    {n}
                  </td>
                  {Array.from({ length: width }, (_, c) => (
                    <td key={c} className="px-2 py-1.5 max-w-[220px] truncate" title={row[c] ?? ""}>
                      {row[c] ?? ""}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={pending}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={pending || read.dataRowCount === 0}>
          {pending ? "Reading…" : "Continue to columns"}
        </Button>
      </div>
    </div>
  )
}
