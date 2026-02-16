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

interface TriggerReasonItem {
  name: string;
  count: number;
}

interface TriggerReasonChartProps {
  data: TriggerReasonItem[];
}

const BAR_COLOR = "#878cfe";
const COLOR_MUTED = "#d3d5ff";

export function TriggerReasonChart({ data }: TriggerReasonChartProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  const sorted = [...data].sort((a, b) => {
    const aOther = a.name === "unknown";
    const bOther = b.name === "unknown";
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
                const item = payload[0].payload as TriggerReasonItem & {
                  displayName: string;
                };
                return (
                  <div className="bg-white border border-fog-200 rounded-lg px-3 py-2 shadow-lg">
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
              barSize={22}
              onClick={(entry) => {
                if (!entry?.name) return;
                setDrillDown({
                  type: "idv",
                  dimension: "trigger_reason",
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
                  fill={entry.name === "unknown" ? COLOR_MUTED : BAR_COLOR}
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
