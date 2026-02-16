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

interface FrictionTypeItem {
  name: string;
  count: number;
}

interface FrictionTypeChartProps {
  data: FrictionTypeItem[];
}

const BAR_COLOR = "#878cfe";
const COLOR_MUTED = "#d3d5ff";

const CATCHALL_FRICTION = new Set(["other", "none"]);

export function FrictionTypeChart({ data }: FrictionTypeChartProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  const sorted = [...data].sort((a, b) => {
    const aOther = CATCHALL_FRICTION.has(a.name);
    const bOther = CATCHALL_FRICTION.has(b.name);
    if (aOther !== bOther) return aOther ? 1 : -1;
    return b.count - a.count;
  });

  const chartData = sorted.map((d) => ({
    ...d,
    displayName: d.name === "none" ? "General" : toTitleCase(d.name),
  }));

  return (
    <>
      <div className="bg-white rounded-xl border border-fog-200 shadow-sm p-6">
        <ResponsiveContainer width="100%" height={data.length * 44 + 20}>
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
                const item = payload[0].payload as FrictionTypeItem & {
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
                  type: "idv",
                  dimension: "friction_type",
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
                  fill={
                    CATCHALL_FRICTION.has(entry.name)
                      ? COLOR_MUTED
                      : BAR_COLOR
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
