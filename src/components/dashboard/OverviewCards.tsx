"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link"
import { Target, ChartBar, ShieldWarning, ArrowRight } from "@phosphor-icons/react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { CardSkeleton } from "@/components/shared/CardSkeleton"

export function OverviewCards({ period, departmentId, refreshKey }: { period: string, departmentId?: string, refreshKey?: number }) {
  const [metrics, setMetrics] = useState({ objTotal: 0, objOnTrack: 0, kpiTotal: 0, kpiMet: 0, riskHigh: 0, riskMed: 0, riskLow: 0 })
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])
  

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      let objQ = supabase.from('objective_definitions').select('id', { count: 'exact' }).eq('is_active', true)
      let kpiQ = supabase.from('kpi_measurements').select('id, status, kpi_definitions!inner(processes!inner(department_id))', { count: 'exact' })
      let riskQ = supabase.from('risk_definitions').select('id, baseline_severity, baseline_likelihood, risk_procedures!inner(department_id)').eq('is_active', true)

      if (departmentId) {
        objQ = objQ.eq('department_id', departmentId)
        kpiQ = kpiQ.eq('kpi_definitions.processes.department_id', departmentId)
        riskQ = riskQ.eq('risk_procedures.department_id', departmentId)
      }

      const [objs, kpis, risks] = await Promise.all([objQ, kpiQ, riskQ])

      // Objectives tracking count
      let objOnTrackCount = 0
      if (objs.data && objs.data.length > 0) {
        const objIds = objs.data.map((o: any) => o.id)
        const { data: trackingData } = await supabase
          .from('objective_tracking')
          .select('objective_id')
          .in('objective_id', objIds)
          .not('status_vs_target', 'is', null)
        
        if (trackingData) {
          const uniqueObjectivesOnTrack = new Set(trackingData.map(t => t.objective_id))
          objOnTrackCount = uniqueObjectivesOnTrack.size
        }
      }

      const riskData = risks.data || []
      
      let riskHigh = 0
      let riskMed = 0
      let riskLow = 0
      
      riskData.forEach((r: any) => {
        const s = r.baseline_severity || 1
        const l = r.baseline_likelihood || 1
        const score = s * l
        if (score >= 15) riskHigh++
        else if (score >= 8) riskMed++
        else riskLow++
      })

      const kpiData = kpis.data || []
      const kpiMet = kpiData.filter((k: any) => k.status === 'Achieved').length

      setMetrics({
        objTotal: objs.count || 0,
        objOnTrack: objOnTrackCount,
        kpiTotal: kpis.count || 0,
        kpiMet: kpiMet,
        riskHigh,
        riskMed,
        riskLow
      })
      setLoading(false)
    }
    fetchData()
  }, [departmentId, period, refreshKey, supabase])

  const { objTotal, objOnTrack, kpiTotal, kpiMet, riskHigh, riskMed, riskLow } = metrics
  const objLagging = objTotal - objOnTrack
  const kpiOff = kpiTotal - kpiMet
  const kpiSuccessRate = kpiTotal > 0 ? Math.round((kpiMet / kpiTotal) * 100) : 0
  const totalRisk = riskHigh + riskMed + riskLow

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* ── 1. Objective Card ── */}
      <Card className="">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-muted-foreground">
            Objectives
          </CardTitle>
          <div className="p-2 rounded-lg bg-primary/10 text-primary dark:bg-blue-950/40 dark:text-blue-400">
            <Target className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tracking-tight text-foreground">{objTotal}</div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {objOnTrack} on track
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {objLagging} lagging
            </span>
          </div>
        </CardContent>
        <CardFooter className="pt-2 border-t flex justify-end">
          <Link
            href="/department/objectives"
            className="flex items-center font-medium text-primary hover:text-primary/80 transition-colors"
            title="View all objectives"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardFooter>
      </Card>

      {/* ── 2. KPI Card ── */}
      <Card className="">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-muted-foreground">
            KPI Performance
          </CardTitle>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <ChartBar className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{kpiSuccessRate}%</span>
            <span className="text-sm font-medium text-muted-foreground">success</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {kpiMet} met
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
              {kpiOff} missed
            </span>
          </div>
        </CardContent>
        <CardFooter className="pt-2 border-t flex justify-end">
          <Link
            href="/department/kpis"
            className="flex items-center font-medium text-primary hover:text-primary/80 transition-colors"
            title="Update actuals"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardFooter>
      </Card>

      {/* ── 3. Risk Card ── */}
      <Card className="">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-muted-foreground">
            Risk Profile
          </CardTitle>
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <ShieldWarning className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tracking-tight text-foreground">{totalRisk}</div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
              {riskHigh} high
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {riskMed} med
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {riskLow} low
            </span>
          </div>
        </CardContent>
        <CardFooter className="pt-2 border-t flex justify-end">
          <Link
            href="/department/risks"
            className="flex items-center font-medium text-primary hover:text-primary/80 transition-colors"
            title="View register"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
