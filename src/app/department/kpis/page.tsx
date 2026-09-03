import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileSpreadsheet, Edit2, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const mockData = [
  {
    id: "kpi-1",
    name: "Latency",
    target: "< 170ms",
    actual: "96.733 ms",
    status: "Achieved",
    justification: "",
  },
  {
    id: "kpi-2",
    name: "System Uptime (Availability)",
    target: "99.9%",
    actual: "98.2%",
    status: "Deviated",
    justification: "Core router failure on Mar 12th resulted in 4 hours downtime.",
  },
  {
    id: "kpi-3",
    name: "Mean Time to Resolve (MTTR)",
    target: "< 4 Hours",
    actual: "2.5 Hours",
    status: "Achieved",
    justification: "",
  },
]

export default function KPITrackingPage() {
  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight">KPI Tracking</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Key Performance Indicators and input quarterly actuals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Plus className="h-4 w-4" />
            Create KPI
          </Button>
        </div>
      </div>

      {/* ── KPI Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10">KPI Description</TableHead>
              <TableHead className="h-10">Target Value</TableHead>
              <TableHead className="h-10">Actual Value</TableHead>
              <TableHead className="h-10">Status</TableHead>
              <TableHead className="h-10">Justification</TableHead>
              <TableHead className="h-10 w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockData.map((row) => (
              <TableRow 
                key={row.id} 
                className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
              >
                <TableCell className="font-medium max-w-[250px] truncate" title={row.name}>
                  {row.name}
                </TableCell>
                <TableCell>{row.target}</TableCell>
                <TableCell className="font-semibold">{row.actual || "-"}</TableCell>
                <TableCell>
                  {row.status === "Achieved" ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Achieved</Badge>
                  ) : row.status === "Deviated" ? (
                    <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Deviated</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate" title={row.justification}>
                  {row.justification || "-"}
                </TableCell>
                <TableCell>
                  {/* Placeholder for Delete Button in Brick 3 */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
