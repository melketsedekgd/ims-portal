"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Risk, rpn } from "@/types/risks";

interface RiskDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: Risk | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-[13.5px] text-gray-900">{value || "—"}</p>
    </div>
  );
}

function RpnRow({ severity, likelihood, score }: { severity: number; likelihood: number; score: number }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-center">
        <p className="text-[16px] font-semibold text-gray-900">{severity}</p>
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Severity</p>
      </div>
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-center">
        <p className="text-[16px] font-semibold text-gray-900">{likelihood}</p>
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Likelihood</p>
      </div>
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-center">
        <p className="text-[16px] font-semibold text-gray-900">{score}</p>
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">RPN (S×L)</p>
      </div>
    </div>
  );
}

export function RiskDetail({ open, onOpenChange, risk }: RiskDetailProps) {
  if (!risk) return null;

  const currentRpn = rpn(risk.current);
  const residualRpn = rpn(risk.residual);
  const improvement = currentRpn - residualRpn;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{risk.group}</p>
          <DialogTitle className="text-[18px] font-semibold text-gray-900">
            {risk.threat}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Section title="Risk Overview">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Affected Assets" value={risk.assets} />
              <Field label="Threat" value={risk.threat} />
              <Field label="Vulnerability" value={risk.vulnerability} />
              <Field label="Risk Owner" value={risk.owner} />
            </div>
            <Field label="Risk Statement" value={risk.statement} />
          </Section>

          <Section title="Current State">
            <RpnRow severity={risk.current.severity} likelihood={risk.current.likelihood} score={currentRpn} />
          </Section>

          <Section title="Treatment">
            <Field label="Treatment Solution" value={risk.treatment} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of Realization — Starting" value={risk.dateStarting} />
              <Field label="Date of Realization — Finishing" value={risk.dateFinishing} />
            </div>
            <Field label="Evidence for Monitoring & Evaluation" value={risk.evidenceMonitoring} />
          </Section>

          <Section title="Residual Risk">
            <RpnRow severity={risk.residual.severity} likelihood={risk.residual.likelihood} score={residualRpn} />
          </Section>

          <Section title="Effectiveness & Follow-up">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Treatment Solution Effectiveness" value={risk.effectiveness} />
              <Field label="RPN Improvement Level" value={String(improvement)} />
            </div>
            <Field label="Evidence for Solutions" value={risk.evidenceSolutions ?? ""} />
            <Field label="Reason for Deviation" value={risk.reasonForDeviation ?? ""} />
            <Field label="Followup Measure" value={risk.followupMeasure ?? ""} />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}