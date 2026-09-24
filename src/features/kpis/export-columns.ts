import type { ExportColumn } from "@/lib/export/download";
import type { KpiExportRow } from "./export";

/** The KPI export's columns, in file order. Shared by every export format. */
export const KPI_EXPORT_COLUMNS: ExportColumn<KpiExportRow>[] = [
  { header: "Department", key: "department", width: 12 },
  { header: "Process", key: "process", width: 28 },
  { header: "KPI", key: "kpi", width: 44 },
  { header: "Target", key: "target", width: 22 },
  { header: "Actual", key: "actual", width: 22 },
  { header: "Status", key: "status", width: 18 },
];
