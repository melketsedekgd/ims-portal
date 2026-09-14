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

  useEffect(() => {
    async function fetchLookups() {
      const { data: procRows } = await supabase
        .from("processes")
        .select("id, process_name")
        .order("process_name")
      if (procRows) {
        setProcesses(procRows.map((p: any) => ({ id: p.id, name: p.process_name })))
      }
      setLoadingLookups(false)
    }
    fetchLookups()
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (data: KpiFormData) => {
    setSaving(true)

    // Resolve process_id from the selected process name
    const proc = processes.find((p) => p.name === data.processName)
    if (!proc) {
      toast.error("Could not find the selected process. Please try again.")
      setSaving(false)
      return
    }

    const { error } = await supabase.from("kpi_definitions").insert({
      process_id: proc.id,
      kpi_name: data.name,
      target_value: data.target,
      unit: "",                             // UI doesn't have a separate unit field yet
      source: data.dataSource ?? "Manual",
      analysis_frequency: "MONTHLY",        // default; form can expose this later
      custom_metadata: {
        responsibility: data.responsibility,
        analysisMethodology: data.analysisMethodology,
        customFields: data.customFields ?? [],
      },
    })

    setSaving(false)

    if (error) {
      console.error("Supabase INSERT error:", error)
      toast.error(`Failed to save: ${error.message}`)
      return
    }

    toast.success(`"${data.name}" has been created successfully.`)
    router.push("/department/kpis")
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
            Saving to database...
          </div>
        )}
      </div>
    </div>
  )
}

