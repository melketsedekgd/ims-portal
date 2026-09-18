/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { CheckCircle, Tray, PaperPlaneRight, ArrowRight, Signature, XCircle, CircleDashed } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import Link from "next/link"

import { useEmployee } from "@/lib/employee-context"

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<"inbox" | "outbox">("inbox")
  const [inboxItems, setTrayItems] = useState<any[]>([])
  const [outboxItems, setOutboxItems] = useState<any[]>([])
  const [rejectingItem, setRejectingItem] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [reasonError, setReasonError] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const employee = useEmployee()
  const employeeId = employee?.id
  const employeeRole = employee?.company_role_id

  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      if (!employeeId) return

        let query = supabase
        .from('approval_requests')
        .select(`
          id,
          entity_type,
          entity_id,
          status,
          current_step_index,
          is_delegated,
          updated_at,
          requested_by,
          departments ( department_name, manager_id ),
          employees ( full_name ),
          workflow_templates (
             workflow_template_steps ( id, step_order, label, company_role_id )
          )
        `)
        .order('updated_at', { ascending: false })

      if (employee.role !== 'SYSTEM_ADMIN') {
        query = query.eq('department_id', employee.department_id)
      }

      const { data: reqs, error: reqErr } = await query
      
      if (reqs && !reqErr) {
        const inbox: any[] = []
        const outbox: any[] = []

        for (const r of reqs) {
          const templates = Array.isArray(r.workflow_templates) ? r.workflow_templates[0] : r.workflow_templates
          const steps = Array.isArray(templates?.workflow_template_steps) ? templates.workflow_template_steps : []
          steps.sort((a: any, b: any) => a.step_order - b.step_order)
          
          let currentStepLabel = 'Unknown Step'
          let isMyTurn = false
          
          if (r.current_step_index === -1) {
            currentStepLabel = 'Department Manager Pre-Approval'
            const depts = Array.isArray(r.departments) ? r.departments[0] : r.departments
            if (depts?.manager_id === employeeId) {
              isMyTurn = true
            }
          } else {
            const currentStep = steps[r.current_step_index]
            currentStepLabel = currentStep?.label || 'Unknown Step'
            if (currentStep?.company_role_id === employeeRole) {
              isMyTurn = true
            }
          }
          
          let statusLabel = 'Pending Approval'
          if (r.status === 'PUBLISHED') statusLabel = 'Published'
          else if (r.status === 'REJECTED') statusLabel = 'Rejected'

          const mapped = {
            id: r.id,
            title: `${(r.entity_type as string).toUpperCase()} Submission`,
            name: `${r.departments?.department_name || 'Department'} ${r.entity_type}`,
            processName: r.departments?.department_name || 'General',
            type: r.entity_type.charAt(0).toUpperCase() + r.entity_type.slice(1),
            author: r.employees?.full_name || 'Unknown',
            workflowStatus: statusLabel,
            currentStepLabel,
            lastUpdated: new Date(r.updated_at).toLocaleDateString(),
            url: `/department/${r.entity_type}s`
          }

          // In Outbox if I requested it
          if (r.requested_by === employeeId) {
            outbox.push(mapped)
          }

          // In Tray if it's pending and it's my turn
          if (r.status === 'PENDING_APPROVAL' && isMyTurn) {
            inbox.push(mapped)
          }
        }
        
        setOutboxItems(outbox)
        setTrayItems(inbox)
      }
    }
    fetchData()
  }, [supabase, refreshIndex])

  const handleApprove = async (requestId: string, title: string) => {
    if (!employeeId) return
    setIsProcessing(true)
    
    // Call our new Engine API
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'APPROVE',
        requestId,
        actorId: employeeId
      })
    })

    if (!res.ok) {
      const err = await res.json()
      setIsProcessing(false)
      toast.error(`Approval failed: ${err.error}`)
      return
    }

    setIsProcessing(false)
    toast.success(`Approved: ${title}`)
    setRefreshIndex(prev => prev + 1)
  }

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      setReasonError(true)
      return
    }
    if (!rejectingItem || !employeeId) return

    setIsProcessing(true)
    
    // Call our new Engine API
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'REJECT',
        requestId: rejectingItem.id,
        actorId: employeeId,
        comment: rejectReason.trim()
      })
    })

    if (!res.ok) {
      const err = await res.json()
      setIsProcessing(false)
      toast.error(`Rejection failed: ${err.error}`)
      return
    }

    setIsProcessing(false)
    toast.success(`Submission returned for revisions with reviewer feedback.`)
    setRejectingItem(null)
    setRejectReason("")
    setReasonError(false)
    setRefreshIndex(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-primary dark:text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Approvals Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your pending approvals and track the status of your submissions.
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-4 border-b dark:border-zinc-800 pb-px">
        <button
          className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "inbox" 
              ? "border-blue-600 text-primary font-medium" 
              : "border-transparent text-muted-foreground hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          onClick={() => setActiveTab("inbox")}
        >
          <Tray className="h-4 w-4" />
          Action Required
          {inboxItems.length > 0 && (
            <Badge className="ml-2 bg-destructive hover:bg-destructive text-white border-transparent">
              {inboxItems.length}
            </Badge>
          )}
        </button>
        <button
          className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "outbox" 
              ? "border-blue-600 text-primary font-medium" 
              : "border-transparent text-muted-foreground hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          onClick={() => setActiveTab("outbox")}
        >
          <PaperPlaneRight className="h-4 w-4" />
          My Requests
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        {activeTab === "inbox" ? (
          <TrayTable 
            items={inboxItems} 
            onApprove={handleApprove}
            onReject={(item) => {
              setRejectingItem(item)
              setRejectReason("")
              setReasonError(false)
            }}
            isProcessing={isProcessing}
          />
        ) : (
          <OutboxTable items={outboxItems} />
        )}
      </div>

      {/* ── Reject Modal ── */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-border dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-destructive dark:text-destructive mb-4">
              <div className="p-2 bg-destructive/10 dark:bg-rose-950/50 rounded-full">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">Reject Submission</h2>
                <p className="text-xs text-muted-foreground">{rejectingItem.title}</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Mandatory Rejection Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value)
                  if (e.target.value.trim()) setReasonError(false)
                }}
                placeholder="Specify required corrections or feedback for the department..."
                className={`w-full h-28 p-3 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 ${
                  reasonError 
                    ? "border-destructive focus:ring-rose-500/20" 
                    : "border-border dark:border-zinc-800 focus:border-blue-500 focus:ring-blue-500/20"
                } resize-none`}
              />
              {reasonError && (
                <p className="text-xs text-destructive font-medium">A reason is required by IMS audit standards.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setRejectingItem(null)
                  setRejectReason("")
                  setReasonError(false)
                }}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleRejectConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? <CircleDashed className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface TrayTableProps {
  items: any[]
  onApprove: (id: string, title: string) => void
  onReject: (item: any) => void
  isProcessing: boolean
}

function TrayTable({ items, onApprove, onReject, isProcessing }: TrayTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
          <CheckCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">You&apos;re all caught up!</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          There are no items currently waiting for your review. When someone submits an item to you, it will appear here.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader className="bg-muted dark:bg-zinc-900/50">
        <TableRow>
          <TableHead className="h-10 pl-6">Type</TableHead>
          <TableHead className="h-10">Name</TableHead>
          <TableHead className="h-10">Department</TableHead>
          <TableHead className="h-10">Waiting On</TableHead>
          <TableHead className="h-10 text-right pr-6">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="hover:bg-muted dark:hover:bg-slate-900/50 group">
            <TableCell className="pl-6">
              <Badge variant="outline" className="text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800">
                {item.type}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">
              {item.name}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {item.processName}
            </TableCell>
            <TableCell>
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400">
                You ({item.currentStepLabel})
              </Badge>
            </TableCell>
            <TableCell className="text-right pr-6">
              <div className="flex items-center justify-end gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 border-rose-200 dark:border-rose-900"
                  onClick={() => onReject(item)}
                  disabled={isProcessing}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
                <Button 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                  onClick={() => onApprove(item.id, item.title)}
                  disabled={isProcessing}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Approve
                </Button>
                <Link href={item.url}>
                  <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-slate-900">
                    <Signature className="h-3.5 w-3.5 mr-1" />
                    Review
                  </Button>
                </Link>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}


function OutboxTable({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
          <PaperPlaneRight className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No requests submitted</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          You haven&apos;t submitted any Objectives or KPIs for approval yet.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader className="bg-muted dark:bg-zinc-900/50">
        <TableRow>
          <TableHead className="h-10 pl-6">Type</TableHead>
          <TableHead className="h-10">Name</TableHead>
          <TableHead className="h-10">Status</TableHead>
          <TableHead className="h-10">Current Step</TableHead>
          <TableHead className="h-10 text-right pr-6"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="hover:bg-muted dark:hover:bg-slate-900/50">
            <TableCell className="pl-6">
              <Badge variant="outline" className={item.type === "Objective" ? "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800" : "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800"}>
                {item.type}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">
              {item.name}
            </TableCell>
            <TableCell>
              {item.workflowStatus === "Pending Approval" && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400">Pending</Badge>
              )}
              {item.workflowStatus === "Rejected" && (
                <Badge className="bg-destructive/20 text-rose-800 hover:bg-destructive/20 dark:bg-rose-900/40 dark:text-rose-400">Rejected</Badge>
              )}
              {item.workflowStatus === "Published" && (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Published</Badge>
              )}
              {item.workflowStatus === "Draft" && (
                <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-muted-foreground">Draft</Badge>
              )}
            </TableCell>
            <TableCell>
              {item.workflowStatus === "Published" ? (
                <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Completed
                </span>
              ) : item.workflowStatus === "Rejected" ? (
                <span className="text-muted-foreground text-sm flex items-center gap-1.5 text-destructive">
                  <XCircle className="h-3.5 w-3.5" />
                  Returned to you
                </span>
              ) : (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  With {item.currentStepLabel}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right pr-6">
              <Link href={item.url}>
                <Button variant="ghost" size="sm" className="h-8 text-primary hover:text-primary hover:bg-primary/10">
                  Track <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
