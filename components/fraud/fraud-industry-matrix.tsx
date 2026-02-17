"use client";

import { useState } from "react";
import { DrillDownPanel } from "@/components/shared/drill-down-panel";
import type { DrillDownConfig } from "@/lib/types/drill-down";
import { toTitleCase, formatNumber } from "@/lib/utils";

interface MatrixData {
  fraudTypes: string[];
  industries: string[];
  matrix: Record<string, Record<string, number>>;
  maxCount: number;
}

interface FraudIndustryMatrixProps {
  data: MatrixData;
}

export function FraudIndustryMatrix({ data }: FraudIndustryMatrixProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  const { fraudTypes, industries, matrix, maxCount } = data;

  // Compute row totals
  const rowTotals: Record<string, number> = {};
  for (const ft of fraudTypes) {
    rowTotals[ft] = industries.reduce(
      (sum, ind) => sum + (matrix[ft]?.[ind] ?? 0),
      0
    );
  }

  // Compute column totals
  const colTotals: Record<string, number> = {};
  for (const ind of industries) {
    colTotals[ind] = fraudTypes.reduce(
      (sum, ft) => sum + (matrix[ft]?.[ind] ?? 0),
      0
    );
  }

  const grandTotal = Object.values(rowTotals).reduce((s, v) => s + v, 0);

  function getCellOpacity(count: number): number {
    if (maxCount === 0 || count === 0) return 0;
    return 0.08 + (count / maxCount) * 0.77;
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-fog-200 shadow-sm p-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left px-3 py-3 text-xs font-semibold text-fog-500 uppercase tracking-wider min-w-[140px]">
                Fraud Type
              </th>
              {industries.map((ind) => (
                <th
                  key={ind}
                  className="text-center px-3 py-3 text-xs font-semibold text-fog-500 uppercase tracking-wider min-w-[100px]"
                >
                  {toTitleCase(ind)}
                </th>
              ))}
              <th className="text-center px-3 py-3 text-xs font-semibold text-fog-500 uppercase tracking-wider min-w-[80px] border-l border-fog-200">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {fraudTypes.map((ft, idx) => (
              <tr key={ft} className={idx % 2 === 1 ? "bg-fog-100/50" : ""}>
                <td className="px-3 py-3 text-sm font-medium text-fog-800">
                  {toTitleCase(ft)}
                </td>
                {industries.map((ind) => {
                  const count = matrix[ft]?.[ind] ?? 0;
                  const opacity = getCellOpacity(count);
                  return (
                    <td
                      key={ind}
                      onClick={() => {
                        if (count > 0) {
                          setDrillDown({
                            type: "fraud",
                            dimension: "fraud_type",
                            value: ft,
                            title: `${toTitleCase(ft)} in ${toTitleCase(ind)}`,
                            secondaryDimension: "industry",
                            secondaryValue: ind,
                          });
                        }
                      }}
                      className={`text-center px-3 py-3 text-sm font-medium transition-colors ${
                        count > 0
                          ? "cursor-pointer hover:ring-2 hover:ring-ube-300 hover:ring-inset"
                          : ""
                      }`}
                      style={{
                        backgroundColor:
                          count > 0
                            ? `rgba(1, 6, 104, ${opacity})`
                            : "transparent",
                        color:
                          opacity > 0.5
                            ? "#ffffff"
                            : count > 0
                              ? "#2b2b2b"
                              : "#d4d4d4",
                      }}
                    >
                      {count > 0 ? count : "-"}
                    </td>
                  );
                })}
                <td className="text-center px-3 py-3 text-sm font-semibold text-fog-500 border-l border-fog-200">
                  {formatNumber(rowTotals[ft])}
                </td>
              </tr>
            ))}
            {/* Column totals */}
            <tr className="border-t border-fog-200">
              <td className="px-3 py-3 text-xs font-semibold text-fog-500 uppercase tracking-wider">
                Total
              </td>
              {industries.map((ind) => (
                <td
                  key={ind}
                  className="text-center px-3 py-3 text-sm font-semibold text-fog-500"
                >
                  {formatNumber(colTotals[ind])}
                </td>
              ))}
              <td className="text-center px-3 py-3 text-sm font-bold text-fog-600 border-l border-fog-200">
                {formatNumber(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <DrillDownPanel config={drillDown} onClose={() => setDrillDown(null)} />
    </>
  );
}
