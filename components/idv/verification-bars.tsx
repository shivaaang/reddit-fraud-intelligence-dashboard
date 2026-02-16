"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { DrillDownPanel } from "@/components/shared/drill-down-panel";
import type { DrillDownConfig } from "@/lib/types/drill-down";
import { toTitleCase, formatNumber } from "@/lib/utils";

interface VerificationTypeItem {
  name: string;
  count: number;
}

interface VerificationBarsProps {
  data: VerificationTypeItem[];
}

const BIOMETRIC_TYPES = [
  "selfie_photo",
  "facial_age_estimation",
  "liveness_check",
];

const COLOR_BIOMETRIC = "#878cfe";
const COLOR_OTHER = "#bec0fe";
const COLOR_MUTED = "#d3d5ff";

const CATCHALL_VERIFICATION = new Set(["other", "unknown"]);

export function VerificationBars({ data }: VerificationBarsProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const biometricCount = data
    .filter((d) => BIOMETRIC_TYPES.includes(d.name))
    .reduce((sum, d) => sum + d.count, 0);
  const biometricPct = total > 0 ? ((biometricCount / total) * 100).toFixed(1) : "0";

  const sorted = [...data].sort((a, b) => {
    const aOther = CATCHALL_VERIFICATION.has(a.name);
    const bOther = CATCHALL_VERIFICATION.has(b.name);
    if (aOther !== bOther) return aOther ? 1 : -1;
    return b.count - a.count;
  });

  const chartData = sorted.map((d) => ({
    ...d,
    displayName: toTitleCase(d.name),
    isBiometric: BIOMETRIC_TYPES.includes(d.name),
  }));

  return (
    <>
      <div className="bg-white rounded-xl border border-fog-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: COLOR_BIOMETRIC }}
              />
              <span className="text-xs text-fog-500">Biometric</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: COLOR_OTHER }}
              />
              <span className="text-xs text-fog-500">Non-biometric</span>
            </div>
          </div>
          <span className="text-xs text-fog-500">
            <span className="font-semibold text-ube-1000">{biometricPct}%</span>{" "}
            involve biometrics
          </span>
        </div>

        <ResponsiveContainer width="100%" height={data.length * 40 + 20}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 50, bottom: 0, left: 140 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="displayName"
              width={140}
              tick={{ fontSize: 13, fill: "#2b2b2b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f6f6f6" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload as VerificationTypeItem & {
                  displayName: string;
                  isBiometric: boolean;
                };
                const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : "0";
                return (
                  <div className="bg-white border border-fog-200 rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-sm font-medium text-fog-800">
                      {item.displayName}
                    </p>
                    <p className="text-sm text-fog-500">
                      {formatNumber(item.count)} ({pct}%)
                    </p>
                    {item.isBiometric && (
                      <p className="text-xs text-ube-1000 mt-1">
                        Biometric method
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              barSize={22}
              onClick={(entry) => {
                if (!entry?.name) return;
                setDrillDown({
                  type: "idv",
                  dimension: "verification_type",
                  value: String(entry.name),
                  title: toTitleCase(String(entry.name)),
                });
              }}
              className="cursor-pointer"
              label={{
                position: "right",
                formatter: (v: unknown) => formatNumber(Number(v)),
                fontSize: 12,
                fill: "#787878",
              }}
            >
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={
                    CATCHALL_VERIFICATION.has(entry.name)
                      ? COLOR_MUTED
                      : entry.isBiometric
                        ? COLOR_BIOMETRIC
                        : COLOR_OTHER
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DrillDownPanel config={drillDown} onClose={() => setDrillDown(null)} />
    </>
  );
}
