/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Download,
  Printer,
  Lock,
  FileBarChart,
  Calendar,
  User,
  ArrowRight,
  Clock,
  AlertTriangle,
  Loader2
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import SlideOutSheet from "@/components/shared/SlideOutSheet"
import ReportForm from "@/components/forms/ReportForm"

// ── Types ──

export type ReportStatus = "Draft" | "Pending Approval" | "Published" | "Rejected"

export interface ReportData {
  id: string
  title: string
  period: string
  publishedAt: string | null
  author: string
  status: ReportStatus
}


// ── Status Badge ──

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  if (status === "Published") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 gap-1.5 px-2.5 py-0.5">
        <Lock className="h-3 w-3" />
        Published
      </Badge>
    )
  }
  if (status === "Pending Approval") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 gap-1.5 px-2.5 py-0.5">
        <Clock className="h-3 w-3" />
        Under Review
      </Badge>
    )
  }
  if (status === "Rejected") {
    return (
      <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400 gap-1.5 px-2.5 py-0.5">
        <AlertTriangle className="h-3 w-3" />
        Needs Revision
      </Badge>
    )
  }
  return (
    <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 gap-1.5 px-2.5 py-0.5">
      <FileText className="h-3 w-3" />
      Draft
    </Badge>
  )
}

// ── Page Component ──

export default function ReportsPage() {
  const [data, setData] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentCycle, setCurrentCycle] = useState<any>(null)
  const [department, setDepartment] = useState<{ id: string; name: string } | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [latestRejectionComment, setLatestRejectionComment] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDraftSheetOpen, setIsDraftSheetOpen] = useState(false)
  const [draftSummary, setDraftSummary] = useState("")

  const currentPeriod = "Q1 2026"
  const supabase = createClient()

  const handleDownload = (title: string) => {
    toast.success(`Downloading "${title}" as PDF...`)
  }

  const handlePrint = (title: string) => {
    toast.info(`Preparing "${title}" for printing...`)
  }

  const [refreshIndex, setRefreshIndex] = useState(0)

  useEffect(() => {
    async function fetchData() {
      // 1. Resolve Department & Employee (placeholder until Auth in Brick 3)
      const { data: deptRows } = await supabase.from('departments').select('id, department_name').limit(1)
      const activeDept = deptRows?.[0]
      if (activeDept) {
        setDepartment({ id: activeDept.id, name: activeDept.department_name })
      }

      const { data: empRows } = await supabase.from('employees').select('id, full_name').limit(1)
      if (empRows?.[0]) {
        setEmployeeId(empRows[0].id)
      }

      // 2. Query Report Cycles
      const { data: cycles } = await supabase
        .from('report_cycles')
        .select(`
          id,
          department_id,
          reporting_period,
          workflow_status,
          updated_at,
          departments ( id, department_name ),
          employees ( full_name )
        `)
        .order('updated_at', { ascending: false })

      if (cycles) {
        const active = cycles.find((c: any) =>
          c.reporting_period === currentPeriod && (!activeDept || c.department_id === activeDept.id)
        )
        setCurrentCycle(active || null)

        if (active?.workflow_status === 'REJECTED') {
          const { data: logRows } = await supabase
            .from('approval_logs')
            .select('comment, created_at')
            .eq('report_cycle_id', active.id)
            .eq('action', 'REJECTED')
            .order('created_at', { ascending: false })
            .limit(1)
          if (logRows?.[0]?.comment) {
            setLatestRejectionComment(logRows[0].comment)
          }
        } else {
          setLatestRejectionComment(null)
        }

        const mapped: ReportData[] = cycles.map((c: any) => {
          let status: ReportStatus = "Draft"
          if (c.workflow_status === 'APPROVED') status = "Published"
          else if (c.workflow_status === 'PENDING_APPROVAL') status = "Pending Approval"
          else if (c.workflow_status === 'REJECTED') status = "Rejected"

          return {
            id: c.id,
            title: `${c.departments?.department_name || 'Department'} Performance Report`,
            period: c.reporting_period,
            publishedAt: c.workflow_status === 'APPROVED' ? new Date(c.updated_at).toLocaleDateString() : null,
            author: c.employees?.full_name || 'Department Manager',
            status
          }
        })
        setData(mapped)
      }
      setLoading(false)
    }

    fetchData()
  }, [supabase, refreshIndex])



  const handleDraft = () => {
    setIsDraftSheetOpen(true)
  }

  const handleSaveDraft = async (summary: string) => {
    if (!department) {
      toast.error("No active department found. Please verify department setup.")
      return
    }
    setIsSubmitting(true)

    const { error } = await supabase
      .from('report_cycles')
      .upsert({
        department_id: department.id,
        reporting_period: currentPeriod,
        workflow_status: 'DRAFT',
        submitted_by: employeeId,
      }, { onConflict: 'department_id, reporting_period' })

    setIsSubmitting(false)
    if (error) {
      toast.error(`Failed to save draft: ${error.message}`)
      return
    }
    setDraftSummary(summary)
    toast.success("Draft saved successfully.")
    setIsDraftSheetOpen(false)
    setRefreshIndex((prev) => prev + 1)
  }

  const handlePublish = async (summary: string) => {
    if (!department) {
      toast.error("No active department found.")
      return
    }
    setIsSubmitting(true)

    // 1. Upsert cycle with PENDING_APPROVAL status
    const { data: cycleData, error } = await supabase
      .from('report_cycles')
      .upsert({
        department_id: department.id,
        reporting_period: currentPeriod,
        workflow_status: 'PENDING_APPROVAL',
        submitted_by: employeeId,
      }, { onConflict: 'department_id, reporting_period' })
      .select()
      .single()

    if (error || !cycleData) {
      setIsSubmitting(false)
      toast.error(`Failed to submit report: ${error?.message || 'Unknown database error'}`)
      return
    }

    // 2. Insert into approval_logs
    const { error: logError } = await supabase.from('approval_logs').insert({
      report_cycle_id: cycleData.id,
      actor_id: employeeId,
      action: 'SUBMITTED',
      step_name: 'Department Head',
      comment: summary || `Submitted ${currentPeriod} departmental report for IMS compliance review.`
    })

    if (logError) {
      console.warn("Approval log creation warning:", logError.message)
    }

    setIsSubmitting(false)
    setIsDraftSheetOpen(false)
    toast.success(`${currentPeriod} Report submitted for review! It has been routed to the IMS Manager.`)
    setRefreshIndex((prev) => prev + 1)
  }

  return (
    <div className="flex-1 p-4 md:p-6 space-y-8 w-full max-w-[1600px] mx-auto relative">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />
          <h1 className="text-2xl font-bold tracking-tight">Compliance & Audit Reports</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Generate, review, and export formal quarterly reports for the IMS audit trail.
        </p>
      </div>

      {/* ── Active Cycle (Draft / In Review / Approved) ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Current Cycle</h2>
        <Card className="border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-3">
                  {currentPeriod} {department?.name ? `${department.name} ` : ""}Review
                  <ReportStatusBadge 
                    status={
                      currentCycle?.workflow_status === 'APPROVED' ? 'Published' :
                      currentCycle?.workflow_status === 'PENDING_APPROVAL' ? 'Pending Approval' :
                      currentCycle?.workflow_status === 'REJECTED' ? 'Rejected' : 'Draft'
                    } 
                  />
                </CardTitle>
                <CardDescription>
                  {currentCycle?.workflow_status === 'APPROVED' 
                    ? "This quarter's report has been formally approved and locked for the compliance audit trail."
                    : currentCycle?.workflow_status === 'PENDING_APPROVAL'
                    ? "This report has been submitted and is currently pending review by the IMS Manager."
                    : currentCycle?.workflow_status === 'REJECTED'
                    ? "This submission was rejected by the IMS Manager and requires revision."
                    : "Compile your objectives, KPI actuals, and risk register into a finalized report."
                  }
                </CardDescription>
                {latestRejectionComment && currentCycle?.workflow_status === 'REJECTED' && (
                  <div className="mt-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md text-xs text-rose-800 dark:text-rose-300">
                    <span className="font-semibold">Reviewer Feedback:</span> &quot;{latestRejectionComment}&quot;
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleDraft}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {currentCycle?.workflow_status === 'APPROVED' ? 'View Report' :
                   currentCycle?.workflow_status === 'PENDING_APPROVAL' ? 'View Submission' :
                   currentCycle?.workflow_status === 'REJECTED' ? 'Revise Report' :
                   'Draft Report'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500/70" />
                Due: April 15, 2026
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500/70" />
                Author: {department?.name ? `${department.name} Lead` : "Department Lead"}
              </div>
              {currentCycle?.updated_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500/70" />
                  Last Updated: {new Date(currentCycle.updated_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* ── Archived Reports Table ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Archived Reports</h2>
        <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
              <TableRow>
                <TableHead className="h-10 pl-6">Report Title</TableHead>
                <TableHead className="h-10">Period</TableHead>
                <TableHead className="h-10">Published Date</TableHead>
                <TableHead className="h-10">Author</TableHead>
                <TableHead className="h-10">Status</TableHead>
                <TableHead className="h-10 text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground animate-pulse">Fetching Report Cycles...</TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">No reports found.</TableCell>
              </TableRow>
            ) : data.map((report) => (
                <TableRow key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <TableCell className="font-medium pl-6">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      {report.title}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {report.period}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {report.publishedAt || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {report.author}
                  </TableCell>
                  <TableCell>
                    <ReportStatusBadge status={report.status} />
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                        onClick={() => handleDownload(report.title)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                        title="Print Report"
                        onClick={() => handlePrint(report.title)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Slide-Out Draft Sheet ── */}
      <SlideOutSheet
        title={`${currentPeriod} Executive Summary`}
        description="Review auto-generated snapshots and provide a narrative overview before publishing."
        isOpen={isDraftSheetOpen}
        onClose={() => setIsDraftSheetOpen(false)}
      >
        <ReportForm
          period={currentPeriod}
          initialSummary={draftSummary}
          readOnly={currentCycle?.workflow_status === 'PENDING_APPROVAL' || currentCycle?.workflow_status === 'APPROVED'}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          onCancel={() => setIsDraftSheetOpen(false)}
        />
      </SlideOutSheet>
    </div>
  )
}
