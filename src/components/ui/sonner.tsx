"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle2, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-100 group-[.toaster]:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:group-[.toaster]:bg-zinc-950 dark:group-[.toaster]:text-slate-100 dark:group-[.toaster]:border-zinc-800 rounded-2xl p-4 items-start relative overflow-hidden w-full",
          content: "ml-3 flex-1 flex flex-col gap-1",
          title: "text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-none",
          description: "text-[13px] text-slate-500 dark:text-slate-400 leading-snug",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: 
            "!opacity-100 !bg-transparent !border-none !text-slate-400 hover:!text-slate-700 dark:hover:!text-slate-200 !absolute !right-3 !top-3 !translate-x-0 !translate-y-0",
          icon: "m-0 flex-shrink-0",
        },
      }}
      icons={{
        success: (
          <div className="relative">
            <div className="absolute -left-10 -top-10 h-[150px] w-[150px] -z-10 bg-emerald-300/25 dark:bg-emerald-900/40 blur-2xl rounded-full pointer-events-none" />
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 shadow-[0_2px_12px_rgb(0,0,0,0.06)] border border-slate-50 dark:border-zinc-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" strokeWidth={2.5} />
            </div>
          </div>
        ),
        info: (
          <div className="relative">
            <div className="absolute -left-10 -top-10 h-[150px] w-[150px] -z-10 bg-blue-300/25 dark:bg-blue-900/40 blur-2xl rounded-full pointer-events-none" />
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 shadow-[0_2px_12px_rgb(0,0,0,0.06)] border border-slate-50 dark:border-zinc-800">
              <Info className="h-5 w-5 text-blue-500" strokeWidth={2.5} />
            </div>
          </div>
        ),
        warning: (
          <div className="relative">
            <div className="absolute -left-10 -top-10 h-[150px] w-[150px] -z-10 bg-amber-300/25 dark:bg-amber-900/40 blur-2xl rounded-full pointer-events-none" />
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 shadow-[0_2px_12px_rgb(0,0,0,0.06)] border border-slate-50 dark:border-zinc-800">
              <AlertTriangle className="h-5 w-5 text-amber-500" strokeWidth={2.5} />
            </div>
          </div>
        ),
        error: (
          <div className="relative">
            <div className="absolute -left-10 -top-10 h-[150px] w-[150px] -z-10 bg-rose-300/25 dark:bg-rose-900/40 blur-2xl rounded-full pointer-events-none" />
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 shadow-[0_2px_12px_rgb(0,0,0,0.06)] border border-slate-50 dark:border-zinc-800">
              <XCircle className="h-5 w-5 text-rose-500" strokeWidth={2.5} />
            </div>
          </div>
        ),
        loading: (
          <div className="relative">
            <div className="absolute -left-10 -top-10 h-[150px] w-[150px] -z-10 bg-slate-300/25 dark:bg-slate-800/40 blur-2xl rounded-full pointer-events-none" />
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 shadow-[0_2px_12px_rgb(0,0,0,0.06)] border border-slate-50 dark:border-zinc-800">
              <Loader2 className="h-5 w-5 text-slate-500 animate-spin" strokeWidth={2.5} />
            </div>
          </div>
        ),
      }}
      {...props}
    />
  )
}

export { Toaster }
