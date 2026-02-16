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

interface PlatformFrictionItem {
  platform: string;
  count: number;
  topFriction: string;
}

interface PlatformFrictionChartProps {
  data: PlatformFrictionItem[];
}

const BAR_COLOR = "#878cfe";

// Custom bar label that shows count + friction badge
function CustomBarLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
  index?: number;
  data: PlatformFrictionItem[];
}) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, data } = props;
  const item = data[index];
  if (!item) return null;

  const labelX = x + width + 8;
  const labelY = y + height / 2;
  const frictionText = toTitleCase(item.topFriction);

  return (
    <g>
      <text
        x={labelX}
        y={labelY - 7}
        textAnchor="start"
        dominantBaseline="middle"
        style={{ fontSize: 13, fontWeight: 600, fill: "#2b2b2b" }}
      >
        {formatNumber(item.count)}
      </text>
      <rect
        x={labelX}
        y={labelY + 1}
        width={frictionText.length * 6.2 + 12}
        height={18}
        rx={9}
        fill="#f6f6f6"
        stroke="#d4d4d4"
        strokeWidth={0.5}
      />
      <text
        x={labelX + 6}
        y={labelY + 10}
        textAnchor="start"
        dominantBaseline="middle"
        style={{ fontSize: 10, fill: "#787878" }}
      >
        {frictionText}
      </text>
    </g>
  );
}

export function PlatformFrictionChart({ data }: PlatformFrictionChartProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  return (
    <>
      <div className="bg-white rounded-xl border border-fog-200 shadow-md p-8">
        <ResponsiveContainer width="100%" height={data.length * 56 + 20}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 180, bottom: 0, left: 100 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="platform"
              width={100}
              tick={{ fontSize: 13, fill: "#2b2b2b", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f6f6f6" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload as PlatformFrictionItem;
                return (
                  <div className="bg-white border border-fog-300 rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-sm font-medium text-fog-800">
                      {item.platform}
                    </p>
                    <p className="text-sm text-fog-500">
                      {formatNumber(item.count)} posts
                    </p>
                    <p className="text-xs text-fog-500 mt-1">
                      Top friction: {toTitleCase(item.topFriction)}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              barSize={28}
              onClick={(entry) => {
                const platform = (entry as unknown as Record<string, unknown>).platform;
                if (!platform) return;
                setDrillDown({
                  type: "idv",
                  dimension: "platform_name",
                  value: String(platform),
                  title: String(platform),
                });
              }}
              className="cursor-pointer"
              label={<CustomBarLabel data={data} />}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DrillDownPanel config={drillDown} onClose={() => setDrillDown(null)} />
    </>
  );
}
