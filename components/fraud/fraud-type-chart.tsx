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

interface FraudTypeItem {
  name: string;
  count: number;
}

interface FraudTypeChartProps {
  data: FraudTypeItem[];
}

const BAR_COLOR = "#878cfe";
const COLOR_MUTED = "#d3d5ff";

export function FraudTypeChart({ data }: FraudTypeChartProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  const sorted = [...data].sort((a, b) => {
    const aOther = a.name === "other";
    const bOther = b.name === "other";
    if (aOther !== bOther) return aOther ? 1 : -1;
    return b.count - a.count;
  });

  const chartData = sorted.map((d) => ({
    ...d,
    displayName: toTitleCase(d.name),
  }));

  return (
    <>
      <div className="bg-white rounded-xl border border-fog-200 shadow-sm p-6">
        <ResponsiveContainer width="100%" height={data.length * 44 + 20}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 140 }}
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
                const item = payload[0].payload as FraudTypeItem & {
                  displayName: string;
                };
                return (
                  <div className="bg-white border border-fog-200 shadow-sm rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-sm font-medium text-fog-800">
                      {item.displayName}
                    </p>
                    <p className="text-sm text-fog-500">
                      {formatNumber(item.count)} posts
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              barSize={24}
              onClick={(entry) => {
                if (!entry?.name) return;
                setDrillDown({
                  type: "fraud",
                  dimension: "fraud_type",
                  value: String(entry.name),
                  title: toTitleCase(String(entry.name)),
                });
              }}
              className="cursor-pointer"
              label={{
                position: "right",
                formatter: (v) => formatNumber(Number(v)),
                fontSize: 12,
                fill: "#787878",
              }}
            >
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.name === "other" ? COLOR_MUTED : BAR_COLOR}
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
