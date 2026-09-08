"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import ObjectiveForm, { ObjectiveFormData } from "@/components/forms/ObjectiveForm"
import { mockAvailableKpis, mockProcesses } from "@/lib/mockData"

export default function CreateObjectivePage() {
  const router = useRouter()

  const handleCreate = (data: ObjectiveFormData) => {
    // In a real app, this would be an API call
    toast.success(`"${data.name || 'Objective'}" has been created.`)
    router.push("/department/objectives")
  }

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push("/department/objectives")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Objective</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define a new departmental objective for this reporting cycle.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <ObjectiveForm
          mode="create"
          processes={mockProcesses}
          availableKpis={mockAvailableKpis}
          onSubmit={handleCreate}
          onCancel={() => router.push("/department/objectives")}
        />
      </div>
    </div>
  )
}
