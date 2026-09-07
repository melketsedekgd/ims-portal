import { Check, Clock, XCircle, CircleDashed, CheckCircle, XCircle as XCircleIcon } from "lucide-react"
import { WorkflowStatus } from "@/types/workflow"
import { Button } from "@/components/ui/button"

interface WorkflowStepperProps {
  steps: string[]
  currentStepIndex: number
  status: WorkflowStatus
  canApprove?: boolean
  onApprove?: () => void
  onReject?: () => void
}

export function WorkflowStepper({ 
  steps, 
  currentStepIndex, 
  status,
  canApprove = false,
  onApprove,
  onReject
}: WorkflowStepperProps) {
  return (
    <div className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-6">
      <div className="flex flex-col space-y-8">
        
        {/* Header & Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <span>Approval Workflow</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              status === "Published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" :
              status === "Rejected" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400" :
              status === "Draft" ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" :
              "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
            }`}>
              {status}
            </span>
          </h3>

          {/* Action Buttons for Approver */}
          {canApprove && status === "Pending Approval" && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                onClick={onReject}
              >
                <XCircleIcon className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button 
                size="sm" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={onApprove}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </div>
          )}
        </div>
        
        {/* The Visual Stepper */}
        <div className="relative pt-2">
          {/* Connecting Line */}
          <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-100 dark:bg-zinc-800 -translate-y-1/2 rounded-full" />
          
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex || status === "Published"
              const isCurrent = index === currentStepIndex && status !== "Published" && status !== "Rejected"
              const isRejectedAtThisStep = index === currentStepIndex && status === "Rejected"
              
              return (
                <div key={index} className="flex flex-col items-center gap-2 group relative z-10 w-24">
                  {/* Circle */}
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors bg-white dark:bg-zinc-950 ${
                    isCompleted 
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isRejectedAtThisStep
                      ? "bg-rose-500 border-rose-500 text-white"
                      : isCurrent
                      ? "border-blue-500 text-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                      : "border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600"
                  }`}>
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : isRejectedAtThisStep ? (
                      <XCircle className="w-4 h-4" />
                    ) : isCurrent ? (
                      <Clock className="w-4 h-4 animate-pulse" />
                    ) : (
                      <CircleDashed className="w-4 h-4" />
                    )}
                  </div>
                  
                  {/* Label */}
                  <div className="text-center">
                    <p className={`text-xs font-semibold ${
                      isCompleted || isCurrent || isRejectedAtThisStep
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-400 dark:text-zinc-500"
                    }`}>
                      {step}
                    </p>
                    {isCurrent && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                        In Review
                      </p>
                    )}
                    {isRejectedAtThisStep && (
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                        Needs Revision
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
