"use client"

import { useState } from "react"
import { OverviewCards } from "@/components/dashboard/OverviewCards"
import { TrendCharts } from "@/components/dashboard/TrendCharts"
import { RiskMatrix } from "@/components/dashboard/RiskMatrix"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { PendingActions } from "@/components/dashboard/PendingActions"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function DepartmentDashboardPage() {
  const currentDate = new Date()
  const actualQuarter = `Q${Math.floor(currentDate.getMonth() / 3) + 1}`
  const actualYear = currentDate.getFullYear().toString()

  // Time-travel state
  const [activeQuarter, setActiveQuarter] = useState(actualQuarter)
  const [activeYear, setActiveYear] = useState(actualYear)

  const isLive = activeQuarter === actualQuarter && activeYear === actualYear

  return (
    <div className="flex-1 space-y-3 p-4 md:p-6 w-full">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Department Dashboard</h1>
            
            {/* Dynamic Status Badge */}
            {isLive ? (
              <Badge variant="outline" className="gap-2 px-3 py-1 text-sm font-semibold rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-400 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-2 px-3 py-1 text-sm font-semibold rounded-full border-slate-300 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400 dark:bg-zinc-500"></span>
                </span>
                Historical
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of objectives, KPIs, and risk registers for the selected period.
          </p>
        </div>

        {/* ── Global Period Picker ── */}
        <div className="flex items-center gap-2">
          <Select value={activeQuarter} onValueChange={(v) => v && setActiveQuarter(v)}>
            <SelectTrigger className="w-[80px] h-9 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Q1","Q2","Q3","Q4"].map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activeYear} onValueChange={(v) => v && setActiveYear(v)}>
            <SelectTrigger className="w-[90px] h-9 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Dashboard Bento Grid ── */}
      
      {/* Row 1: The Quick Pulse (100% width) */}
      <div className="w-full">
        <OverviewCards period={`${activeQuarter} ${activeYear}`} />
      </div>

      {/* ── Dashboard Columns (Left 60% / Right 40%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        
        {/* Left Column: Heavy Analytics & Activity */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <TrendCharts />
          <RecentActivity />
        </div>
        
        {/* Right Column: Risk & Pending Actions */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <RiskMatrix period={`${activeQuarter} ${activeYear}`} />
          <PendingActions />
        </div>
        
      </div>

    </div>
  )
}
