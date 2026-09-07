"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import { Risk, rpn, riskLevel } from "@/types/risks";

interface RiskTableProps {
  risks: Risk[];
  isLoading?: boolean;
  onRowClick: (risk: Risk) => void;
}

const LEVEL_TEXT: Record<string, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-rose-600",
  critical: "text-rose-700",
};

const LEVEL_DOT: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
  critical: "bg-rose-700",
};

function LevelIndicator({ score }: { score: number }) {
  const level = riskLevel(score);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium ${LEVEL_TEXT[level]}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${LEVEL_DOT[level]}`}
      />
      {score}
    </span>
  );
}

export function RiskTable({
  risks,
  isLoading = false,
  onRowClick,
}: RiskTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table className="min-w-[1200px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[100px]">Risk ID</TableHead>
            <TableHead className="w-[170px]">Affected Assets</TableHead>
            <TableHead className="w-[170px]">Threat</TableHead>
            <TableHead className="w-[170px]">Vulnerability</TableHead>
            <TableHead className="w-[160px]">Risk Treatment</TableHead>
            <TableHead className="w-[100px]">RPN</TableHead>
            <TableHead className="w-[140px]">Department</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-10 text-center text-[13px] text-gray-400"
              >
                Loading risks...
              </TableCell>
            </TableRow>
          ) : risks.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-10 text-center text-[13px] text-gray-400"
              >
                No risks logged yet for this period.
              </TableCell>
            </TableRow>
          ) : (
            risks.map((r) => (
              <TableRow
                key={r.id}
                onClick={() => onRowClick(r)}
                className="cursor-pointer transition-colors hover:bg-gray-50"
              >
                <TableCell className="align-top text-[13px] font-medium text-gray-900">
                  {r.id}
                </TableCell>

                <TableCell className="whitespace-normal break-words align-top text-[13px] text-gray-600">
                  {r.assets}
                </TableCell>

                <TableCell className="whitespace-normal break-words align-top text-[13px] text-gray-600">
                  {r.threat}
                </TableCell>

                <TableCell className="whitespace-normal break-words align-top text-[13px] text-gray-600">
                  {r.vulnerability}
                </TableCell>

                <TableCell className="whitespace-normal break-words align-top text-[13px] text-gray-600">
                  {r.treatment}
                </TableCell>

                <TableCell className="align-top">
                  <LevelIndicator score={rpn(r.current)} />
                </TableCell>

                <TableCell className="align-top text-[13px] text-gray-600">
                  {r.department}
                </TableCell>

                <TableCell className="align-top text-[13px] text-gray-600">
                  {r.status}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}