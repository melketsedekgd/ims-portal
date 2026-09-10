"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Target, Activity, History, Lock, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { mockApprovalLogs } from "@/lib/mockData"
import { Badge } from "@/components/ui/badge"
import ObjectiveForm, { ObjectiveFormData, ObjectiveStatus } from "@/components/forms/ObjectiveForm"
import { mockObjectives, mockProcesses } from "@/lib/mockData"

// ── Status Badge Renderer ──
function StatusBadge({ status }: { status: ObjectiveStatus }) {
  switch (status) {
    case "Achieved":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Achieved</Badge>
    case "On Track":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400">On Track</Badge>
    case "At Risk":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400">At Risk</Badge>
    case "Off Track":
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Off Track</Badge>
  }
}

export default function ObjectiveDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [activeTab, setActiveTab] = useState<"plan" | "progress" | "history">("plan")
  const [objective, setObjective] = useState<ObjectiveFormData | null>(null)

  useEffect(() => {
    // In a real app, this would be a fetch
    const found = mockObjectives.find(o => o.id === id)
    if (found) {
      setTimeout(() => setObjective(found), 0)
    }
  }, [id])

  if (!objective) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-[50vh]">
        <Target className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold">Objective Not Found</h2>
        <p className="text-muted-foreground text-sm mt-2">The objective you are looking for does not exist or was deleted.</p>
        <Button variant="outline" className="mt-6" onClick={() => router.push("/department/objectives")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Objectives
        </Button>
      </div>
    )
  }

  const isLocked = objective.status === "Achieved"

  const handleUpdate = (updatedData: ObjectiveFormData) => {
    setObjective(updatedData)
    toast.success(`Objective "${updatedData.name}" has been updated.`)
    // In a real app, send to API here
  }

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/department/objectives")}
            className="shrink-0 mt-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Badge variant="outline" className="text-[11px] font-medium uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-zinc-900">
                {objective.processName}
              </Badge>
              <StatusBadge status={objective.status} />
              {isLocked && (
                <Badge variant="outline" className="text-[11px] border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400 gap-1">
                  <Lock className="h-3 w-3" /> Locked
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {objective.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              {objective.description || "No description provided."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="border-b border-slate-200 dark:border-zinc-800">
        <div className="flex gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("plan")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "plan" 
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400" 
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <Target className="h-4 w-4" />
            Objective Plan
          </button>
          <button
            onClick={() => setActiveTab("progress")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "progress" 
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400" 
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <Activity className="h-4 w-4" />
            Progress & Audit
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "history" 
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400" 
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <History className="h-4 w-4" />
            History Log
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 md:p-8 shadow-sm">
        
        {activeTab === "plan" && (
          <ObjectiveForm
            key={`plan-${objective.id}`}
            initialData={objective}
            mode={isLocked ? "view-all" : "edit-plan"}
            readOnly={isLocked}
            processes={mockProcesses}
            onSubmit={handleUpdate}
            onCancel={() => router.push("/department/objectives")}
          />
        )}

        {activeTab === "progress" && (
          <ObjectiveForm
            key={`progress-${objective.id}`}
            initialData={objective}
            mode={isLocked ? "view-all" : "review-progress"}
            readOnly={isLocked}
            processes={mockProcesses}
            onSubmit={handleUpdate}
            onCancel={() => router.push("/department/objectives")}
          />
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">Audit History Log</h3>
              <p className="text-sm text-muted-foreground mt-1">
                System-generated log of all changes made to this objective.
              </p>
            </div>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-zinc-800 before:to-transparent">
              {mockApprovalLogs.filter(log => log.itemId === objective.id).map((log) => (
                <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-zinc-950 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${
                    log.action === "Rejected" ? "bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-400" :
                    log.action === "Approved" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400" :
                    "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
                  }`}>
                    {log.action === "Rejected" ? <XCircle className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">
                        {log.action}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{log.actorName}</span> 
                      {log.comment ? ` left a comment:` : ` performed this action.`}
                    </p>
                    {log.comment && (
                      <div className="mt-2 p-3 bg-white dark:bg-zinc-950 rounded-md border border-slate-200 dark:border-zinc-800 text-sm text-slate-600 dark:text-slate-300 italic">
                        &quot;{log.comment}&quot;
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {mockApprovalLogs.filter(log => log.itemId === objective.id).length === 0 && (
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-zinc-950 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                    <Target className="w-4 h-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Objective Created</span>
                      <span className="text-xs text-muted-foreground">Jan 12, 2026</span>
                    </div>
                    <p className="text-xs text-muted-foreground">System Admin initiated the objective for Q1 2026.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
