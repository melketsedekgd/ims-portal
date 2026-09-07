"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RiskMatrix } from "@/components/risks/RiskMatrix";
import { RiskTable } from "@/components/risks/RiskTable";
import { RiskDialog } from "@/components/risks/RiskDialog";
import { RiskDetail } from "@/components/risks/RiskDetail";
import { Risk, NewRiskInput } from "@/types/risks";

interface DepartmentRisksViewProps {
  department: string;
  risks: Risk[];
  isLoading?: boolean;
  onCreateRisk: (data: NewRiskInput) => void | Promise<void>;
}

export function DepartmentRisksView({
  department,
  risks,
  isLoading = false,
  onCreateRisk,
}: DepartmentRisksViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);

  const selectedRisk =
    risks.find((risk) => risk.id === selectedRiskId) ?? null;

  function openCreate() {
    setDialogOpen(true);
  }

  function openRiskDetail(risk: Risk) {
    setSelectedRiskId(risk.id);
  }

  function closeRiskDetail() {
    setSelectedRiskId(null);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
            Risks
          </h1>

          <p className="mt-0.5 text-[13px] text-gray-500">
            Risk register and matrix for the {department} department
          </p>
        </div>

      </div>

      {/* Risk Matrices */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RiskMatrix
          title="Risk Matrix"
          description="Current state by likelihood × severity"
          risks={risks}
          mode="current"
        />

        <RiskMatrix
          title="Residual Risk Matrix"
          description="After treatment by likelihood × severity"
          risks={risks}
          mode="residual"
        />
      </div>
       <Button
          onClick={openCreate}
          className="h-9 gap-1.5 rounded-lg bg-gray-900 px-3.5 text-[13px] font-medium text-white hover:bg-gray-800"
        >
          
          Identify Risk
        </Button>
      {/* Risk Table */}
      <RiskTable
        risks={risks}
        isLoading={isLoading}
        onRowClick={openRiskDetail}
      />

      {/* Create Risk Dialog */}
      <RiskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        risk={null}
        onSave={async (risk) => {
          await onCreateRisk({
            group: risk.group,
            assets: risk.assets,
            threat: risk.threat,
            vulnerability: risk.vulnerability,
            treatment: risk.treatment,
            department: department,
            status: risk.status,
            statement: risk.statement,
            currentSeverity: risk.current.severity,
            currentLikelihood: risk.current.likelihood,
            dateStarting: risk.dateStarting,
            dateFinishing: risk.dateFinishing,
            evidenceMonitoring: risk.evidenceMonitoring,
            residualSeverity: risk.residual.severity,
            residualLikelihood: risk.residual.likelihood,
            owner: risk.owner,
            effectiveness: risk.effectiveness,
            evidenceSolutions: risk.evidenceSolutions ?? "",
            reasonForDeviation: risk.reasonForDeviation ?? "",
            followupMeasure: risk.followupMeasure ?? "",
          });

          setDialogOpen(false);
        }}
      />

      {/* Risk Detail Dialog */}
      <RiskDetail
        open={selectedRisk !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeRiskDetail();
          }
        }}
        risk={selectedRisk}
      />

    </div>
  );
}