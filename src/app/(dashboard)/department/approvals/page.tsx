"use client"

import { useState } from "react"
import { CheckCircle2, Inbox, Send, ArrowRight, FileSignature } from "lucide-react"
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
import { mockKpis } from "@/lib/mockData"
import Link from "next/link"

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<"inbox" | "outbox">("inbox")
  
  // Mock logged in user (e.g., IMS Manager)
  

  // Mock data mapping (In a real app, this would be a filtered backend query combining KPIs and Objectives)
  //
  // Objectives are no longer listed here. ObjectiveFormData dropped
  // workflowStatus when the objectives page moved onto real queries — nothing
  // in the schema backs a workflow state — and both filters below key off it,
  // so an objective could only ever have appeared with an undefined status.
  // KPIs still carry the mock field and are unaffected.
  const allItems = [
    ...mockKpis.map(k => ({ ...k, type: "KPI", url: `/department/kpis/${k.id}` }))
  ]

  // Outbox: Items submitted by the current user (Mocking that they are the Writer for all items for demo purposes)
  const outboxItems = allItems.filter(item => item.workflowStatus !== "Draft")

  // Inbox: Items currently sitting at this user's step index.
  // We mock this by showing items that are Pending Approval.
  const inboxItems = allItems.filter(item => item.workflowStatus === "Pending Approval")

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-500" />
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
              ? "border-blue-600 text-blue-600 font-medium" 
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          onClick={() => setActiveTab("inbox")}
        >
          <Inbox className="h-4 w-4" />
          Action Required
          {inboxItems.length > 0 && (
            <Badge className="ml-2 bg-rose-500 hover:bg-rose-600 text-white border-transparent">
              {inboxItems.length}
            </Badge>
          )}
        </button>
        <button
          className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "outbox" 
              ? "border-blue-600 text-blue-600 font-medium" 
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          onClick={() => setActiveTab("outbox")}
        >
          <Send className="h-4 w-4" />
          My Requests
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        {activeTab === "inbox" ? (
          <InboxTable items={inboxItems} />
        ) : (
          <OutboxTable items={outboxItems} />
        )}
      </div>
    </div>
  )
}

function InboxTable({ items }: { items: any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */ }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-6 w-6 text-slate-400" />
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
      <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
        <TableRow>
          <TableHead className="h-10 pl-6">Type</TableHead>
          <TableHead className="h-10">Name</TableHead>
          <TableHead className="h-10">Department / Process</TableHead>
          <TableHead className="h-10">Waiting On</TableHead>
          <TableHead className="h-10 text-right pr-6">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 group">
            <TableCell className="pl-6">
              <Badge variant="outline" className={item.type === "Objective" ? "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800" : "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800"}>
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
                You
              </Badge>
            </TableCell>
            <TableCell className="text-right pr-6">
              <Link href={item.url}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8">
                  <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                  Review
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function OutboxTable({ items }: { items: any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */ }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
          <Send className="h-6 w-6 text-slate-400" />
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
      <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
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
          <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
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
                <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Rejected</Badge>
              )}
              {item.workflowStatus === "Published" && (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Published</Badge>
              )}
              {item.workflowStatus === "Draft" && (
                <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400">Draft</Badge>
              )}
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                {item.workflowStatus === "Pending Approval" ? "With IMS Manager" : "Completed"}
              </span>
            </TableCell>
            <TableCell className="text-right pr-6">
              <Link href={item.url}>
                <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
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
