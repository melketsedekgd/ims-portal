"use client"

import { Activity, Shield, FileCheck, Users, Search, Filter } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ── Mock Data ──

export const mockAuditLogs = [
  { id: "evt-101", user: "Nahom Tesfaye", email: "nahom@company.com", action: "escalated system role to SUPER_ADMIN for", target: "Elena Tadesse", time: "2026-09-05 14:32:00", type: "Security" },
  { id: "evt-102", user: "David Haile", email: "david@company.com", action: "published and locked", target: "Q4 2025 Service Delivery Report", time: "2026-09-05 11:15:00", type: "Compliance" },
  { id: "evt-103", user: "Sarah Mengistu", email: "sarah@company.com", action: "created a new department:", target: "Security Operations", time: "2026-09-05 09:45:00", type: "Access" },
  { id: "evt-104", user: "Nahom Tesfaye", email: "nahom@company.com", action: "suspended user account for", target: "Amir Kebede", time: "2026-09-04 16:20:00", type: "Security" },
  { id: "evt-105", user: "System", email: "system@ims.local", action: "auto-archived", target: "Legacy Hardware Objectives", time: "2026-09-04 00:00:00", type: "Compliance" },
  { id: "evt-106", user: "Elena Tadesse", email: "elena@company.com", action: "updated KPI target for", target: "Server Uptime (99.99%)", time: "2026-09-03 15:10:00", type: "Compliance" },
  { id: "evt-107", user: "David Haile", email: "david@company.com", action: "flagged risk as CRITICAL:", target: "Core Router End-of-Life", time: "2026-09-03 10:05:00", type: "Security" },
  { id: "evt-108", user: "Sarah Mengistu", email: "sarah@company.com", action: "assigned Dept Head role to", target: "David Haile", time: "2026-09-02 14:00:00", type: "Access" },
  { id: "evt-109", user: "Amir Kebede", email: "amir@company.com", action: "attempted login with invalid credentials", target: "Failed Login", time: "2026-09-02 09:30:00", type: "Security" },
  { id: "evt-110", user: "System", email: "system@ims.local", action: "generated weekly digest for", target: "All Department Heads", time: "2026-09-01 08:00:00", type: "Compliance" },
]

export default function ActivityLogPage() {
  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto relative">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-slate-800 dark:text-slate-200" />
            <h1 className="text-2xl font-bold tracking-tight">System Activity Log</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive audit trail of all security, access, and compliance events.
          </p>
        </div>
      </div>

      {/* ── Data Table (Brick A Foundation) ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6 w-[200px]">Timestamp</TableHead>
              <TableHead className="h-10 w-[250px]">Actor</TableHead>
              <TableHead className="h-10">Event Details</TableHead>
              <TableHead className="h-10 w-[150px]">Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockAuditLogs.map((row) => (
              <TableRow key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                
                {/* Timestamp */}
                <TableCell className="pl-6 text-sm text-muted-foreground whitespace-nowrap">
                  {row.time}
                </TableCell>
                
                {/* Actor */}
                <TableCell>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{row.user}</div>
                  <div className="text-xs text-muted-foreground">{row.email}</div>
                </TableCell>
                
                {/* Event Details */}
                <TableCell className="text-sm">
                  <span className="text-muted-foreground">{row.action}</span>{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-200">{row.target}</span>
                </TableCell>
                
                {/* Event Type Badge/Icon */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {row.type === "Security" && (
                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400">
                        <Shield className="h-3 w-3" /> Security
                      </span>
                    )}
                    {row.type === "Compliance" && (
                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                        <FileCheck className="h-3 w-3" /> Compliance
                      </span>
                    )}
                    {row.type === "Access" && (
                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                        <Users className="h-3 w-3" /> Access
                      </span>
                    )}
                  </div>
                </TableCell>
                
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

    </div>
  )
}
