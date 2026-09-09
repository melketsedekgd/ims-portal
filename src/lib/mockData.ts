import { ObjectiveFormData } from "@/components/forms/ObjectiveForm"
import { AvailableKpi } from "@/components/forms/ObjectiveForm"

export const mockProcesses = [
  "Service Delivery",
  "Incident Management",
  "Change Management",
  "Problem Management",
]

export const mockAvailableKpis: AvailableKpi[] = [
  { name: "Latency", processName: "Service Delivery" },
  { name: "System Uptime (Availability)", processName: "Service Delivery" },
  { name: "Mean Time to Resolve (MTTR)", processName: "Incident Management" },
  { name: "Incident Recurrence Rate", processName: "Incident Management" },
  { name: "Failed Change Rate", processName: "Change Management" },
]

export const mockObjectives: ObjectiveFormData[] = [
  {
    id: "obj-1",
    period: "Q1 2026",
    workflowStatus: "Pending Approval",
    currentStepIndex: 1,
    processName: "Service Delivery",
    name: "Achieve 99.9% System Uptime",
    description: "Ensure all production systems maintain at least 99.9% availability throughout the reporting period.",
    successCriteria: "Zero critical service outages exceeding 15 minutes; all microservices deployed on multi-zone HA.",
    targetDate: "Q4 2026",
    status: "At Risk",
    actualPerformance: "98.7% uptime currently recorded",
    evidenceOfAchievement: "https://monitoring.internal.ims/uptime-q4",
    reasonForDeviation: "Storage controller latency spike during November data migration caused unexpected failover delay.",
    followUpActions: "Procure redundant NVMe SAN controller and implement automated failover pre-checks by end of month.",
    linkedKpis: ["System Uptime (Availability)", "Latency"],
  },
  {
    id: "obj-2",
    period: "Q1 2026",
    workflowStatus: "Pending Approval",
    currentStepIndex: 1,
    processName: "Service Delivery",
    name: "Reduce Network Latency Below 100ms",
    description: "Optimize network infrastructure to achieve sub-100ms average latency across all endpoints.",
    successCriteria: "Global edge CDN routing enabled; internal WAN optimization appliance updated across all 8 branches.",
    targetDate: "Q2 2026",
    status: "Achieved",
    actualPerformance: "78ms average latency verified across all branches",
    evidenceOfAchievement: "https://reports.internal.ims/latency-audit-q2.pdf",
    reasonForDeviation: "",
    followUpActions: "Maintain monthly CDN routing optimization reviews.",
    linkedKpis: ["Latency"],
  },
  {
    id: "obj-3",
    period: "Q4 2025",
    workflowStatus: "Pending Approval",
    currentStepIndex: 1,
    processName: "Incident Management",
    name: "Resolve Incidents Within 4 Hours",
    description: "Improve incident response workflows to bring mean time to resolution under 4 hours.",
    successCriteria: "L1/L2 on-call escalation runbooks standardized and integrated with automatic PagerDuty alerts.",
    targetDate: "Q3 2026",
    status: "On Track",
    actualPerformance: "3.2 hours MTTR achieved in last 60 days",
    evidenceOfAchievement: "https://jira.internal.ims/servicedesk-sla-report",
    reasonForDeviation: "",
    followUpActions: "Roll out automated post-incident review template.",
    linkedKpis: ["Mean Time to Resolve (MTTR)", "Incident Recurrence Rate"],
  },
  {
    id: "obj-4",
    period: "Q1 2026",
    workflowStatus: "Pending Approval",
    currentStepIndex: 1,
    processName: "Change Management",
    name: "Reduce Failed Change Rate to Under 5%",
    description: "Implement stricter change review and rollback procedures to reduce failed deployments.",
    successCriteria: "All production deployments validated through staging environment with automated smoke tests.",
    targetDate: "Q3 2026",
    status: "Off Track",
    actualPerformance: "8.4% failed changes recorded in sprint review",
    evidenceOfAchievement: "https://github.internal.ims/deployment-metrics/q3",
    reasonForDeviation: "Legacy database migrations bypassed staging automation due to manual hotfix requests.",
    followUpActions: "Enforce strict CI/CD gate locking hotfixes to staging validation before production promotion.",
    linkedKpis: ["Failed Change Rate"],
  },
]

import { KpiFormData } from "@/components/forms/KpiForm"

export const mockKpis: KpiFormData[] = [
  {
    id: "kpi-1",
    period: "Q1 2026",
    workflowStatus: "Pending Approval",
    currentStepIndex: 1,
    processName: "Software Development",
    name: "Average Sprint Velocity",
    target: "10 Story points",
    dataSource: "Story points from Completed Stories and Tasks from Scrum Board",
    analysisFrequency: "Quarterly",
    analysisMethodology: "(Total Story Points Completed in the period / Number of Sprints Completed in the Period)",
    responsibility: "Scrum Master",
    actual: "6.5 story points",
    achievementPercentage: "100%",
    evidence: "GitHub",
    status: "Achieved",
    justification: "While the capacity target was 10 points, the current backlog only required 6.5 points. We successfully delivered 100% of the prioritized user stories.",
  },
  {
    id: "kpi-2",
    period: "Q1 2026",
    workflowStatus: "Pending Approval",
    currentStepIndex: 1,
    processName: "Software Development",
    name: "Average Lead Time",
    target: "2 weeks",
    dataSource: "Added to Sprint and Completed dates of all Completed Stories and Tasks from Scrum Board",
    analysisFrequency: "Quarterly",
    analysisMethodology: "Sum(Task Completed Date - Task Added To Sprint Date) / Number of Completed Tasks",
    responsibility: "Scrum Master",
    actual: "1.8 weeks",
    achievementPercentage: "100%",
    evidence: "GitHub",
    status: "Achieved",
    justification: "Target met",
  },
  {
    id: "kpi-3",
    period: "Q1 2026",
    workflowStatus: "Pending Approval",
    currentStepIndex: 1,
    processName: "Software Development",
    name: "Average Cycle time",
    target: "1 week",
    dataSource: "Started and Completed dates of all Completed Stories and Tasks from Scrum Board",
    analysisFrequency: "Quarterly",
    analysisMethodology: "Sum(Task Completed Date - Task Started Date) / Number of Completed Tasks",
    responsibility: "Scrum Master",
    actual: "1 week",
    achievementPercentage: "100%",
    evidence: "GitHub",
    status: "Achieved",
    justification: "Target met",
  },
  {
    id: "kpi-4",
    period: "Q1 2026",
    workflowStatus: "Pending Approval",
    currentStepIndex: 1,
    processName: "Software Development",
    name: "PR review time",
    target: "1 day",
    dataSource: "Pull Requests data from Version Control System",
    analysisFrequency: "Quarterly",
    analysisMethodology: "Sum(PR Approved Date - PR Raised Date) / Number of Approved PRs",
    responsibility: "Scrum Master",
    actual: "1 Day",
    achievementPercentage: "100%",
    evidence: "GitHub",
    status: "Achieved",
    justification: "Target met",
  },
  {
    id: "kpi-5",
    period: "Q4 2025",
    workflowStatus: "Pending Approval",
    currentStepIndex: 1,
    processName: "Software Development",
    name: "Security issues Resolution Time",
    target: "5 days",
    dataSource: "Security issue tickets from Scrum Board",
    analysisFrequency: "Quarterly",
    analysisMethodology: "Sum(Issue Resolved Date - Issue Created Date) / Number of Issues",
    responsibility: "Scrum Master",
    actual: "0 day",
    achievementPercentage: "100%",
    evidence: "GitHub",
    status: "Achieved",
    justification: "Target met",
  }
]

import { RiskFormData } from "@/components/forms/RiskForm"

export const mockRisks: RiskFormData[] = [
  // ── Service Delivery Process ──
  {
    id: "risk-1",
    period: "Q1 2026",
    processName: "Service Delivery",
    title: "Core Router Single Point of Failure",
    description: "Primary data center router has no failover. A hardware failure would cause full service outage.",
    likelihood: 3,
    severity: 5,
    riskScore: 15,
    mitigationStrategy: "Procure redundant router and configure automatic failover by Q2 2026.",
    status: "Mitigating",
  },
  {
    id: "risk-2",
    period: "Q1 2026",
    processName: "Service Delivery",
    title: "CDN Provider Service Degradation",
    description: "Dependency on a single CDN provider creates latency risk if their network degrades.",
    likelihood: 2,
    severity: 3,
    riskScore: 6,
    mitigationStrategy: "Evaluate multi-CDN strategy and implement DNS-based failover.",
    status: "Open",
  },
  // ── Incident Management Process ──
  {
    id: "risk-3",
    period: "Q1 2026",
    processName: "Incident Management",
    title: "Understaffed On-Call Rotation",
    description: "Only 2 engineers cover after-hours incidents, leading to delayed response times.",
    likelihood: 4,
    severity: 4,
    riskScore: 16,
    mitigationStrategy: "Hire 2 additional SREs and implement PagerDuty escalation policies.",
    status: "Open",
  },
  {
    id: "risk-4",
    period: "Q1 2026",
    processName: "Incident Management",
    title: "Lack of Automated Incident Detection",
    description: "Most incidents are reported manually by users rather than caught by monitoring.",
    likelihood: 3,
    severity: 3,
    riskScore: 9,
    mitigationStrategy: "Deploy Datadog APM with automated alerting thresholds.",
    status: "Mitigating",
  },
  // ── Change Management Process ──
  {
    id: "risk-5",
    period: "Q4 2025",
    processName: "Change Management",
    title: "Insufficient Rollback Procedures",
    description: "Emergency patches lack documented rollback plans, increasing the risk of failed changes.",
    likelihood: 3,
    severity: 4,
    riskScore: 12,
    mitigationStrategy: "Mandate rollback documentation as a gate in the change approval workflow.",
    status: "Closed",
  },
]

import { WorkflowTemplate, ApprovalLog } from "@/types/workflow"

export const mockWorkflowTemplates: WorkflowTemplate[] = [
  {
    id: "wt-1",
    departmentName: "Service Delivery",
    entityType: "Objective",
    steps: ["Writer", "QMS Coordinator", "IMS Manager", "VP", "Published"]
  },
  {
    id: "wt-2",
    departmentName: "Incident Management",
    entityType: "KPI",
    steps: ["Writer", "IMS Manager", "VP", "Published"]
  }
]

export const mockApprovalLogs: ApprovalLog[] = [
  {
    id: "log-1",
    itemId: "obj-1",
    actorName: "Nahom (Writer)",
    action: "Submitted",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: "log-2",
    itemId: "obj-1",
    actorName: "Sarah (QMS Coordinator)",
    action: "Approved",
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
  }
]
