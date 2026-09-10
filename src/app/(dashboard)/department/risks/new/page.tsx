"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import RiskForm, { RiskFormData } from "@/components/forms/RiskForm"
import { mockProcesses } from "@/lib/mockData"

export default function CreateRiskPage() {
  const router = useRouter()

  const handleCreate = (data: RiskFormData) => {
    toast.success(`"${data.title || 'Risk'}" has been logged.`)
    router.push("/department/risks")
  }

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push("/department/risks")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log New Risk</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identify and assess a new risk for this reporting cycle.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <RiskForm
          mode="create"
          processes={mockProcesses}
          onSubmit={handleCreate}
          onCancel={() => router.push("/department/risks")}
        />
      </div>
    </div>
  )
}
