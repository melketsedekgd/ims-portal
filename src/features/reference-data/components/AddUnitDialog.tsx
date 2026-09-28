"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CircleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UnitOption } from "@/features/kpis/queries"
import { createUnit } from "../mutations"
import { unitInputSchema } from "../schema"

/** The "What does it measure?" value that asks for a new dimension. */
const NEW_DIMENSION = "__new__"

type Field = "key" | "label" | "dimension" | "factor"
type FieldErrors = Partial<Record<Field, string>>

/** 'story_points' → 'Story points'. */
function dimensionLabel(dimension: string): string {
  const words = dimension.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Enough precision for 0.001 or 2629800, without float noise like 0.30000000000000004. */
function formatNumber(n: number): string {
  return Number(n.toPrecision(12)).toLocaleString("en-US", { maximumFractionDigits: 6 })
}

/**
 * The dialog behind "+ Add unit…". Mount it only while open, so every
 * opening starts blank.
 *
 * A unit either joins an existing dimension, with its size stated against
 * that dimension's base unit (the one with factor 1), or starts a dimension
 * of its own and becomes its base. The factor is what scoring converts with,
 * so the dialog spells it out as a sentence and previews a conversion.
 *
 * fixedDimension pins the dimension, for a select that only lists units
 * comparable with one KPI's target: a unit from elsewhere would not appear
 * in it.
 */
export default function AddUnitDialog({
  units,
  fixedDimension,
  onCreated,
  onClose,
}: {
  units: UnitOption[]
  fixedDimension?: string
  onCreated: (unit: UnitOption) => void
  onClose: () => void
}) {
  const [label, setLabel] = useState("")
  const [key, setKey] = useState("")
  const [dimension, setDimension] = useState(fixedDimension ?? "")
  const [newDimensionName, setNewDimensionName] = useState("")
  const [factor, setFactor] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isNew = dimension === NEW_DIMENSION
  const dimensions = [...new Set(units.map((u) => u.dimension))].sort()
  const dimensionItems = [
    ...dimensions.map((d) => ({ value: d, label: dimensionLabel(d) })),
    ...(fixedDimension ? [] : [{ value: NEW_DIMENSION, label: "Something new" }]),
  ]
  const base = isNew ? undefined : units.find((u) => u.dimension === dimension && u.factorToBase === 1)

  const symbol = key.trim() || "unit"
  const factorNumber = factor.trim() === "" ? NaN : Number(factor)
  const preview =
    base && Number.isFinite(factorNumber) && factorNumber > 0
      ? `A target of 2 ${symbol} will be compared as ${formatNumber(2 * factorNumber)} ${base.key}.`
      : null

  /** Wraps a setter so editing a field clears its error. */
  const edit = (field: Field, set: (v: string) => void) => (v: string) => {
    set(v)
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
  }

  const save = () => {
    const parsed = unitInputSchema.safeParse({
      key,
      label,
      dimension: isNew ? newDimensionName : dimension,
      newDimension: isNew,
      factor: isNew || factor.trim() === "" ? undefined : Number(factor),
    })
    const next: FieldErrors = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field
        next[field] ??= issue.message
      }
    }
    // The list is the whole table, so a clash is caught here; create_unit()
    // checks again for one added since the page loaded.
    if (!next.key && units.some((u) => u.key.toLowerCase() === key.trim().toLowerCase())) {
      next.key = "A unit with that symbol already exists"
    }
    if (!next.dimension && isNew) {
      const slug = newDimensionName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
      if (!slug) next.dimension = "Give the new dimension a name"
      else if (dimensions.includes(slug)) next.dimension = `"${dimensionLabel(slug)}" already exists; choose it from the list`
    }
    if (!parsed.success || Object.keys(next).length > 0) {
      setErrors(next)
      setBanner(null)
      return
    }

    setErrors({})
    setBanner(null)
    startTransition(async () => {
      const result = await createUnit(parsed.data)
      if (result.ok) {
        toast.success(`Unit "${result.unit.label}" added.`)
        onCreated(result.unit)
      } else {
        setBanner(result.message)
      }
    })
  }

  const describedBy = (field: Field, hintId?: string) =>
    [errors[field] ? `unit-${field}-error` : null, hintId].filter(Boolean).join(" ") || undefined

  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={`unit-${field}-error`} className="text-xs text-rose-600 dark:text-rose-400">
        {errors[field]}
      </p>
    ) : null

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-48px)] flex-col gap-0 p-0 sm:max-w-[520px]">
        <DialogHeader className="shrink-0 gap-1 px-6 pt-5 pb-3 pr-12">
          <DialogTitle className="text-lg font-semibold">Add unit</DialogTitle>
          <DialogDescription>
            Units are shared by every department. Once a KPI uses one, only its name can change.
          </DialogDescription>
        </DialogHeader>

        <form
          id="add-unit-form"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pt-2 pb-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {banner && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{banner}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
            <div className="space-y-2">
              <Label htmlFor="unit-label">
                Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="unit-label"
                autoFocus
                placeholder="e.g., Minutes"
                value={label}
                disabled={pending}
                onChange={(e) => edit("label", setLabel)(e.target.value)}
                aria-invalid={errors.label ? true : undefined}
                aria-describedby={describedBy("label")}
                className="bg-white dark:bg-slate-950"
              />
              {fieldError("label")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-key">
                Symbol <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="unit-key"
                placeholder="e.g., min"
                maxLength={16}
                value={key}
                disabled={pending}
                onChange={(e) => edit("key", setKey)(e.target.value)}
                aria-invalid={errors.key ? true : undefined}
                aria-describedby={describedBy("key")}
                className="bg-white dark:bg-slate-950 font-mono"
              />
              {fieldError("key")}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-dimension">
              What does it measure? <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={dimension}
              onValueChange={(v) => v && edit("dimension", setDimension)(v)}
              items={dimensionItems}
              disabled={pending || !!fixedDimension}
            >
              <SelectTrigger
                id="unit-dimension"
                className="w-full bg-white dark:bg-slate-950"
                aria-invalid={errors.dimension && !isNew ? true : undefined}
                aria-describedby={isNew ? undefined : describedBy("dimension")}
              >
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {dimensions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {dimensionLabel(d)}
                  </SelectItem>
                ))}
                {!fixedDimension && (
                  <>
                    <SelectSeparator />
                    <SelectItem value={NEW_DIMENSION}>Something new</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {!isNew && fieldError("dimension")}
          </div>

          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="unit-new-dimension">
                New dimension <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="unit-new-dimension"
                placeholder="e.g., Tickets"
                value={newDimensionName}
                disabled={pending}
                onChange={(e) => edit("dimension", setNewDimensionName)(e.target.value)}
                aria-invalid={errors.dimension ? true : undefined}
                aria-describedby={describedBy("dimension", "unit-new-dimension-hint")}
                className="bg-white dark:bg-slate-950"
              />
              {fieldError("dimension")}
              <p id="unit-new-dimension-hint" className="text-xs text-muted-foreground">
                This unit won&apos;t be comparable to others.
              </p>
            </div>
          )}

          {base && (
            <div className="space-y-2">
              <Label htmlFor="unit-factor">
                Size <span className="text-rose-500">*</span>
              </Label>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  1 <span className="font-mono">{symbol}</span> =
                </span>
                <Input
                  id="unit-factor"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={factor}
                  disabled={pending}
                  onChange={(e) => edit("factor", setFactor)(e.target.value)}
                  aria-invalid={errors.factor ? true : undefined}
                  aria-describedby={describedBy("factor", preview ? "unit-factor-preview" : undefined)}
                  className="w-32 bg-white dark:bg-slate-950 font-mono"
                />
                <span className="font-mono">{base.key}</span>
                <span className="text-muted-foreground">({base.label})</span>
              </div>
              {fieldError("factor")}
              {preview && (
                <p id="unit-factor-preview" className="text-xs text-muted-foreground">
                  {preview}
                </p>
              )}
            </div>
          )}
        </form>

        <DialogFooter className="m-0 shrink-0 px-6 py-3.5">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="add-unit-form" disabled={pending}>
            {pending ? "Adding…" : "Add unit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
