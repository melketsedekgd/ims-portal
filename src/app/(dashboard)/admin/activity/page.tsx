"use client"

import { useState } from "react"
import { Activity, Shield, FileCheck, Users, Search, Filter, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("All")
  const [currentPage, setCurrentPage] = useState(1)

  // Filter Logic
  const filteredLogs = mockAuditLogs.filter((log) => {
    const matchesSearch = 
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesType = typeFilter === "All" || log.type === typeFilter
    
    return matchesSearch && matchesType
  })

  // Pagination Logic
  const pageSize = 8
  const totalPages = Math.ceil(filteredLogs.length / pageSize)
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // CSV Export
  const handleExportCSV = () => {
    // 1. Create CSV headers
    const headers = ["ID", "Timestamp", "Actor Name", "Actor Email", "Action", "Target", "Event Type"]
    
    // 2. Map filtered data to CSV rows
    const rows = filteredLogs.map(log => [
      log.id,
      log.time,
      `"${log.user}"`, // Quote strings that might contain commas
      log.email,
      `"${log.action}"`,
      `"${log.target}"`,
      log.type
    ])
    
    // 3. Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n")
    
    // 4. Create Blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `ims_audit_log_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
        <div>
          <Button 
            onClick={handleExportCSV} 
            variant="outline" 
            className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 shadow-sm gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by user, action, or target..." 
            className="pl-9 h-10 w-full bg-white dark:bg-zinc-950"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <Select 
            value={typeFilter} 
            onValueChange={(val) => {
              setTypeFilter(val || "All")
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px] h-10 bg-white dark:bg-zinc-950">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Events</SelectItem>
              <SelectItem value="Security">Security</SelectItem>
              <SelectItem value="Access">Access</SelectItem>
              <SelectItem value="Compliance">Compliance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Data Table ── */}
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
            {paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No activity found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogs.map((row) => (
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
            )))}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50/50 dark:bg-zinc-900/30">
            <p className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium px-2 text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
