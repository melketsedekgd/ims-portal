import type { ExportColumn } from "@/lib/export/download";
import type { RiskExportRow } from "./export";

/** The risk export's columns, in file order. Shared by every export format. */
export const RISK_EXPORT_COLUMNS: ExportColumn<RiskExportRow>[] = [
  { header: "Department", key: "department", width: 12 },
  { header: "Ref", key: "ref", width: 6 },
  { header: "Risk statement", key: "riskStatement", width: 60 },
  { header: "Owner", key: "owner", width: 24 },
  { header: "Score (S×L)", key: "score", width: 13 },
  { header: "Band", key: "band", width: 13 },
  { header: "Status", key: "status", width: 12 },
];
