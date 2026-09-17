"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle2, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react"

/**
 * Toasts use the same card language as the rest of the app: white surface,
 * 1px slate-200 border, small shadow, ink text, a small coloured icon.
 *
 * The theme is pinned to "light". There is no ThemeProvider in this app;
 * a theme hook here fell back to "system", so a dark-mode OS got a
 * black toast in a light-only app.
 *
 * Sonner injects its stylesheet unlayered, and Tailwind v4 emits utilities
 * inside `@layer utilities`, so for any property Sonner sets on an element
 * the utility loses regardless of specificity (the old `group-[.toaster]:`
 * prefixes never actually applied). Where Sonner exposes a CSS variable the
 * `style` block below uses it; the `!` classes are the properties Sonner
 * sets and has no variable for.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "#fff",
          // --border is slate-200 in oklch; same token as every card border.
          "--normal-border": "var(--border)",
          "--normal-text": "var(--ink)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Sonner sets padding, gap, align-items and box-shadow on the
          // toast. `shadow-md!` also replaces its keyboard focus ring (a
          // box-shadow), so the ring is put back with `ring-*`, which
          // composes into the same box-shadow.
          toast:
            "px-3.5! py-3! gap-2.5! items-start! shadow-md! focus-visible:ring-2 focus-visible:ring-slate-300",
          // Keeps text clear of the close button pinned at the right.
          content: "pr-5",
          // Colour is inherited from --normal-text; Sonner's `color: inherit`
          // on the title outranks a text-* utility. Sonner sets line-height.
          title: "text-sm font-medium leading-snug!",
          // Sonner sets colour and line-height on the description.
          description: "text-[13px] text-slate-500! leading-snug!",
          icon: "mt-0.5 shrink-0",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Sonner's default is a bordered circle overlapping the top-left
          // corner (left/top/transform, bg, border and colour are all set
          // by it). This is a bare icon inside the card, top-right.
          closeButton:
            "left-auto! right-3! top-3! transform-none! bg-transparent! border-0! text-slate-400! hover:text-slate-700!",
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-4 text-emerald-600" strokeWidth={2} />,
        error: <XCircle className="size-4 text-rose-600" strokeWidth={2} />,
        warning: <AlertTriangle className="size-4 text-amber-600" strokeWidth={2} />,
        info: <Info className="size-4 text-slate-500" strokeWidth={2} />,
        loading: <Loader2 className="size-4 text-slate-500 animate-spin" strokeWidth={2} />,
      }}
      {...props}
    />
  )
}

export { Toaster }
