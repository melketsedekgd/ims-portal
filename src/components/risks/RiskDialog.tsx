"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Risk, RiskStatus, rpn } from "@/types/risks";

interface RiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: Risk | null;
  onSave: (risk: Risk) => void;
}

const STATUS_OPTIONS: RiskStatus[] = [
  "Open",
  "Under Review",
  "Treated",
  "Closed",
];

const emptyRisk: Risk = {
  id: "",
  group: "",
  assets: "",
  threat: "",
  vulnerability: "",
  owner: "",
  statement: "",
  department: "",
  status: "Open",
  current: { severity: 1, likelihood: 1 },
  treatment: "",
  dateStarting: "",
  dateFinishing: "",
  evidenceMonitoring: "",
  residual: { severity: 1, likelihood: 1 },
  effectiveness: "Maintain",
  evidenceSolutions: null,
  reasonForDeviation: null,
  followupMeasure: null,
};

const controlCls =
  "h-9 rounded-lg border-gray-200 bg-white text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-gray-300";

const getDate = (date: string) => new Date(`${date}T00:00:00`);

const getTomorrow = (date: string) => {
  const tomorrow = getDate(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
};

export function RiskDialog({
  open,
  onOpenChange,
  risk,
  onSave,
}: RiskDialogProps) {
  const [form, setForm] = useState<Risk>(risk || emptyRisk);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const todayString = new Date().toISOString().split("T")[0];
  const today = getDate(todayString);

  const isEditMode = !!risk;

  useEffect(() => {
    setForm(risk || emptyRisk);
    setErrors({});
  }, [risk, open]);

  const update = <K extends keyof Risk>(key: K, value: Risk[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateCurrent = (
    key: "severity" | "likelihood",
    value: number
  ) => {
    setForm((prev) => ({
      ...prev,
      current: {
        ...prev.current,
        [key]: value,
      },
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.assets.trim()) newErrors.assets = "Assets are required.";
    if (!form.threat.trim()) newErrors.threat = "Threat is required.";
    if (!form.vulnerability.trim())
      newErrors.vulnerability = "Vulnerability is required.";
    if (!form.statement.trim())
      newErrors.statement = "Risk statement is required.";
    if (!form.department.trim())
      newErrors.department = "Department is required.";
    if (!form.treatment.trim())
      newErrors.treatment = "Treatment solution is required.";
    if (!form.owner.trim()) newErrors.owner = "Owner is required.";
    if (!form.dateStarting)
      newErrors.dateStarting = "Starting date is required.";
    if (!form.dateFinishing)
      newErrors.dateFinishing = "Finishing date is required.";

    if (form.dateStarting) {
      const startingDate = getDate(form.dateStarting);
      if (startingDate < today) {
        newErrors.dateStarting = "Starting date cannot be in the past.";
      }
    }

    if (form.dateFinishing) {
      const finishingDate = getDate(form.dateFinishing);
      if (finishingDate < today) {
        newErrors.dateFinishing = "Finishing date cannot be in the past.";
      }
    }

    if (form.dateStarting && form.dateFinishing) {
      if (getDate(form.dateFinishing) <= getDate(form.dateStarting)) {
        newErrors.dateFinishing =
          "Finishing date must be after the starting date.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    onSave(form);
    setConfirmOpen(false);
    onOpenChange(false);
  };

  const currentRpn = rpn(form.current);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl border-gray-200 bg-white p-0">
          <DialogHeader className="border-b border-gray-100 px-6 py-5">
            <DialogTitle className="text-[16px] font-medium text-gray-900">
              {isEditMode ? "Edit Risk" : "Create Risk"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 px-6 py-5">
            <section className="space-y-4">
              <h3 className="text-[13px] font-medium text-gray-900">
                Risk Overview
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Assets</Label>
                  <Input
                    className={controlCls}
                    value={form.assets}
                    onChange={(e) => update("assets", e.target.value)}
                  />
                  {errors.assets && (
                    <p className="text-xs text-red-500">{errors.assets}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Threat</Label>
                  <Input
                    className={controlCls}
                    value={form.threat}
                    onChange={(e) => update("threat", e.target.value)}
                  />
                  {errors.threat && (
                    <p className="text-xs text-red-500">{errors.threat}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Vulnerability</Label>
                  <Input
                    className={controlCls}
                    value={form.vulnerability}
                    onChange={(e) =>
                      update("vulnerability", e.target.value)
                    }
                  />
                  {errors.vulnerability && (
                    <p className="text-xs text-red-500">
                      {errors.vulnerability}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    className={controlCls}
                    value={form.department}
                    onChange={(e) =>
                      update("department", e.target.value)
                    }
                  />
                  {errors.department && (
                    <p className="text-xs text-red-500">
                      {errors.department}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Owner</Label>
                  <Input
                    className={controlCls}
                    value={form.owner}
                    onChange={(e) => update("owner", e.target.value)}
                  />
                  {errors.owner && (
                    <p className="text-xs text-red-500">{errors.owner}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      update("status", v as RiskStatus)
                    }
                  >
                    <SelectTrigger className={controlCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Risk Statement</Label>
                  <Textarea
                    className="min-h-[80px] rounded-lg border-gray-200 bg-white text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-gray-300"
                    value={form.statement}
                    onChange={(e) =>
                      update("statement", e.target.value)
                    }
                  />
                  {errors.statement && (
                    <p className="text-xs text-red-500">
                      {errors.statement}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[13px] font-medium text-gray-900">
                Current State
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={String(form.current.severity)}
                    onValueChange={(v) =>
                      updateCurrent("severity", Number(v))
                    }
                  >
                    <SelectTrigger className={controlCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Likelihood</Label>
                  <Select
                    value={String(form.current.likelihood)}
                    onValueChange={(v) =>
                      updateCurrent("likelihood", Number(v))
                    }
                  >
                    <SelectTrigger className={controlCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>RPN</Label>
                  <div className="flex h-9 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-900">
                    {currentRpn}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[13px] font-medium text-gray-900">
                Treatment
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Treatment Solution</Label>
                  <Textarea
                    className="min-h-[80px] rounded-lg border-gray-200 bg-white text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-gray-300"
                    value={form.treatment}
                    onChange={(e) =>
                      update("treatment", e.target.value)
                    }
                  />
                  {errors.treatment && (
                    <p className="text-xs text-red-500">
                      {errors.treatment}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Starting Date</Label>
                    <Input
                      type="date"
                      min={todayString}
                      className={controlCls}
                      value={form.dateStarting}
                      onChange={(e) => {
                        update("dateStarting", e.target.value);
                        setErrors((prev) => ({
                          ...prev,
                          dateStarting: "",
                          dateFinishing: "",
                        }));
                      }}
                    />
                    {errors.dateStarting && (
                      <p className="text-xs text-red-500">
                        {errors.dateStarting}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Finishing Date</Label>
                    <Input
                      type="date"
                      min={
                        form.dateStarting
                          ? getTomorrow(form.dateStarting)
                          : todayString
                      }
                      className={controlCls}
                      value={form.dateFinishing}
                      onChange={(e) => {
                        update("dateFinishing", e.target.value);
                        setErrors((prev) => ({
                          ...prev,
                          dateFinishing: "",
                        }));
                      }}
                    />
                    {errors.dateFinishing && (
                      <p className="text-xs text-red-500">
                        {errors.dateFinishing}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="border-t border-gray-100 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg text-[13px]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-9 rounded-lg text-[13px]"
              onClick={handleSubmit}
            >
              {isEditMode ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEditMode ? "Save changes?" : "Create risk?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isEditMode
                ? "Are you sure you want to save these changes?"
                : "Are you sure you want to create this risk?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {isEditMode ? "Save" : "Create"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}