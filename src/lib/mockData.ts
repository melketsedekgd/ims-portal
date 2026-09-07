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
