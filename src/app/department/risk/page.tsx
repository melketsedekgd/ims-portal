"use client";

import { useState } from "react";

import { DepartmentRisksView } from "@/components/risks/DepartmentRisksView";
import { Risk, NewRiskInput } from "@/types/risks";

/*
 * LOCAL MOCK DATA
 *
 * Later:
 * Fetch from Supabase and filter by the logged-in user's department
 * using profiles.department_id and RLS.
 */

const MOCK_RISKS: Risk[] = [
  {
    id: "1",
    group: "Patch Management Work Instruction",

    assets:
      "Server, Network Devices, Endpoints, Applications",

    threat: "Incomplete Patch Deployment",

    vulnerability:
      "Cumulative risk over time; regulatory and compliance issues",

    statement:
      "Some systems remain unpatched, leaving them vulnerable to exploitation.",

    current: {
      severity: 3,
      likelihood: 2,
    },

    treatment:
      "Enforce patching for endpoints/servers; compliance reporting; escalation for overdue systems.",

    dateStarting: "2026-01-01",
    dateFinishing: "2026-12-31",

    evidenceMonitoring:
      "Patch compliance dashboard; WSUS reports",

    residual: {
      severity: 3,
      likelihood: 1,
    },

    owner: "Cyber Security Analyst",

    effectiveness: "Maintain",

    evidenceSolutions: null,
    reasonForDeviation: null,
    followupMeasure: null,

    department: "IT",
    status: "Open",
  },

  {
    id: "2",
    group: "Access Control Procedure",

    assets:
      "Active Directory, User Accounts, Applications",

    threat: "Unauthorized Access",

    vulnerability:
      "Excessive privileges and inactive accounts may remain enabled.",

    statement:
      "Users may gain unauthorized access to systems or information due to inappropriate access privileges.",

    current: {
      severity: 4,
      likelihood: 3,
    },

    treatment:
      "Review user access regularly; remove inactive accounts; enforce least privilege.",

    dateStarting: "2026-01-01",
    dateFinishing: "2026-06-30",

    evidenceMonitoring:
      "Access review reports; Active Directory audit logs",

    residual: {
      severity: 3,
      likelihood: 2,
    },

    owner: "IT Security Officer",

    effectiveness: "Correction",

    evidenceSolutions:
      "Quarterly access review records",

    reasonForDeviation: null,

    followupMeasure:
      "Continue quarterly access reviews.",

    department: "IT",
    status: "Under Review",
  },

];

export default function DepartmentRisksPage() {
  const [risks, setRisks] =
    useState<Risk[]>(MOCK_RISKS);

  const [isLoading] = useState(false);

  async function handleCreateRisk(
    data: NewRiskInput
  ) {
    /*
     * Later:
     *
     * await supabase
     *   .from("risks")
     *   .insert({
     *      ...data,
     *      department_id
     *   });
     */

    const newRisk: Risk = {
      id: `risk-${Date.now()}`,

      group: data.group,

      assets: data.assets,

      threat: data.threat,

      vulnerability: data.vulnerability,

      statement: data.statement,

      current: {
        severity: data.currentSeverity,
        likelihood: data.currentLikelihood,
      },

      treatment: data.treatment,

      dateStarting: data.dateStarting,

      dateFinishing: data.dateFinishing,

      evidenceMonitoring:
        data.evidenceMonitoring,

      residual: {
        severity: data.residualSeverity,
        likelihood: data.residualLikelihood,
      },

      owner: data.owner,

      effectiveness: data.effectiveness,

      evidenceSolutions:
        data.evidenceSolutions || null,

      reasonForDeviation:
        data.reasonForDeviation || null,

      followupMeasure:
        data.followupMeasure || null,

      // FIXED
      department: data.department,

      // FIXED
      status: data.status,
    };

    setRisks((prev) => [
      ...prev,
      newRisk,
    ]);
  }

  return (
    <div className="p-8">
      <DepartmentRisksView
        department="IT"
        risks={risks}
        isLoading={isLoading}
        onCreateRisk={handleCreateRisk}
      />
    </div>
  );
}