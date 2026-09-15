/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import KpiForm, { KpiFormData } from "@/components/forms/KpiForm"
import { createClient } from "@/lib/supabase/client"

export default function CreateKpiPage() {
  const router = useRouter()
  const supabase = createClient()

  const [processes, setProcesses] = useState<{ id: string; name: string }[]>([])
  const [loadingLookups, setLoadingLookups] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showConfirmProcess, setShowConfirmProcess] = useState(false)
  const [pendingData, setPendingData] = useState<KpiFormData | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [departmentId, setDepartmentId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLookups() {
      // Fetch processes
      const { data: procRows } = await supabase
        .from("processes")
        .select("id, process_name")
        .order("process_name")
      if (procRows) {
        setProcesses(procRows.map((p: any) => ({ id: p.id, name: p.process_name })))
      }
      
      // Fetch current employee details
      const { data: empRows } = await supabase.from('employees').select('id, department_id').limit(1)
      if (empRows?.[0]) {
        setEmployeeId(empRows[0].id)
        setDepartmentId(empRows[0].department_id)
      }
      
      setLoadingLookups(false)
    }
    fetchLookups()
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const executeCreate = async (data: KpiFormData, processId: string) => {
    if (!employeeId || !departmentId) {
      toast.error("Current user context not found.")
      setSaving(false)
      return
    }

    // 1. Insert KPI
    const { data: kpi, error } = await supabase.from("kpi_definitions").insert({
      process_id: processId,
      kpi_name: data.name,
      target_value: data.target,
      unit: "",
      source: data.dataSource ?? "Manual",
      analysis_frequency: "MONTHLY",
      custom_metadata: {
        responsibility: data.responsibility,
        analysisMethodology: data.analysisMethodology,
        customFields: data.customFields ?? [],
      },
    }).select('id').single()

    if (error || !kpi) {
      console.error("Supabase INSERT error:", error)
      toast.error(`Failed to save KPI: ${error?.message}`)
      setSaving(false)
      return
    }

    // 2. Submit to Approval Engine
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUBMIT',
        entityType: 'kpi',
        entityId: kpi.id,
        departmentId: departmentId,
        requestedBy: employeeId
      })
    })

    if (!res.ok) {
      const err = await res.json()
      toast.error(`Workflow engine error: ${err.error}`)
      setSaving(false)
      return
    }

    setSaving(false)
    toast.success(`"${data.name}" submitted for approval successfully.`)
    router.push("/department/kpis")
  }

  const handleCreate = async (data: KpiFormData) => {
    const proc = processes.find((p) => p.name.toLowerCase() === data.processName.toLowerCase().trim())
    
    if (!proc) {
      setPendingData(data)
      setShowConfirmProcess(true)
      return
    }

    setSaving(true)
    await executeCreate(data, proc.id)
  }

  const handleConfirmNewProcess = async () => {
    if (!pendingData || !departmentId) return
    setShowConfirmProcess(false)
    setSaving(true)

    const { data: newProc, error } = await supabase.from('processes').insert({
      department_id: departmentId,
      process_name: pendingData.processName.trim(),
      description: 'Auto-created process'
    }).select('id').single()

    if (error || !newProc) {
      toast.error(`Failed to create process: ${error?.message}`)
      setSaving(false)
      return
    }

    await executeCreate(pendingData, newProc.id)
  }

  if (loadingLookups) {
    return (
      <div className="flex-1 p-4 md:p-6 w-full max-w-3xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading form data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/department/kpis")}
          className="shrink-0"
          disabled={saving}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New KPI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define a new Key Performance Indicator for this reporting cycle.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <KpiForm
          mode="create"
          processes={processes.map((p) => p.name)}
          onSubmit={handleCreate}
          onCancel={() => router.push("/department/kpis")}
        />
        {saving && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving and submitting for approval...
          </div>
        )}
      </div>

      {/* Custom Alert Dialog for New Process */}
      {showConfirmProcess && pendingData && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Create New Process</h2>
            <p className="text-sm text-muted-foreground mb-6">
              The process <strong className="text-slate-900 dark:text-slate-100">"{pendingData.processName.trim()}"</strong> does not exist in your department yet. Do you want to create it?
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirmProcess(false)}>
                Cancel
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmNewProcess}>
                Create & Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

