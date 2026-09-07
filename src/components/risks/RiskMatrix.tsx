"use client";

import { Risk, riskLevel } from "@/types/risks";

interface RiskMatrixProps {
  title: string;
  description: string;
  risks: Risk[];
  mode: "current" | "residual";
  selectedRiskId?: string | null;
  onSelectRisk?: (id: string) => void;
}

const LEVEL_COLOR: Record<
  "low" | "medium" | "high" | "critical",
  string
> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f43f5e",
  critical: "#e11d48",
};

const GRID_SIZE = 5;

export function RiskMatrix({
  title,
  description,
  risks,
  mode,
  selectedRiskId,
  onSelectRisk,
}: RiskMatrixProps) {
  const counts = Array.from(
    { length: GRID_SIZE },
    () => Array(GRID_SIZE).fill(0) as number[]
  );

  risks.forEach((risk) => {
    const state = mode === "current" ? risk.current : risk.residual;

    if (!state) return;

    const severity = Math.max(
      1,
      Math.min(GRID_SIZE, state.severity)
    );

    const likelihood = Math.max(
      1,
      Math.min(GRID_SIZE, state.likelihood)
    );

    const row = GRID_SIZE - severity;
    const col = likelihood - 1;

    counts[row][col] += 1;
  });

  return (
    <div className="w-full max-w-md rounded-sm border border-gray-200 bg-white p-3">
      <div className="mb-3">
        <h4 className="text-[13px] font-semibold text-gray-900">
          {title}
        </h4>

        <p className="text-[11px] text-gray-500">
          {description}
        </p>
      </div>

      <div className="flex gap-1.5">
        <div className="flex w-4 items-center justify-center">
          <span className="rotate-180 text-[9px] font-medium uppercase tracking-wide text-gray-400 [writing-mode:vertical-rl]">
            Severity
          </span>
        </div>

        <div className="flex-1">
          <div
            className="grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            }}
          >
            {counts.map((row, rowIndex) =>
              row.map((count, columnIndex) => {
                const severity = GRID_SIZE - rowIndex;
                const likelihood = columnIndex + 1;
                const score = severity * likelihood;
                const level = riskLevel(score);
                const backgroundColor = LEVEL_COLOR[level];
                const opacity = count > 0 ? 1 : 0.35;

                return (
                  <div
                    key={`${rowIndex}-${columnIndex}`}
                    className="flex h-8 items-center justify-center rounded-none border border-white/30 text-[10px] font-semibold text-white"
                    style={{
                      backgroundColor,
                      opacity,
                    }}
                  >
                    {count > 0 && count}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-1 flex justify-between px-0.5 text-[9px] font-medium text-gray-400">
            {Array.from(
              { length: GRID_SIZE },
              (_, index) => (
                <span key={index}>{index + 1}</span>
              )
            )}
          </div>

          <p className="mt-0.5 text-center text-[9px] font-medium uppercase tracking-wide text-gray-400">
            Likelihood
          </p>
        </div>
      </div>

      {onSelectRisk && risks.length > 0 && (
        <div className="mt-3 space-y-0.5 border-t border-gray-200 pt-2">
          {risks.map((risk) => {
            const state =
              mode === "current"
                ? risk.current
                : risk.residual;

            if (!state) return null;

            const isSelected = selectedRiskId === risk.id;

            return (
              <button
                key={risk.id}
                type="button"
                onClick={() => onSelectRisk(risk.id)}
                className={`flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-[11px] transition-colors ${
                  isSelected
                    ? "bg-gray-100"
                    : "hover:bg-gray-50"
                }`}
              >
                <span className="truncate text-gray-700">
                  {risk.threat}
                </span>

                <span className="ml-2 shrink-0 text-gray-400">
                  S{state.severity} · L{state.likelihood}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}