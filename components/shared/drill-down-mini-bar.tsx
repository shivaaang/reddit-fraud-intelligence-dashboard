"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { toTitleCase, formatNumber } from "@/lib/utils";

const BAR_COLOR = "#878cfe";
const COLOR_MUTED = "#d3d5ff";

const CATCHALL = new Set(["other", "unknown", "unspecified", "none"]);

const LOSS_LABELS: Record<string, string> = {
  none: "No Loss",
  under_100: "Under $100",
  "100_to_1k": "$100-$1K",
  "1k_to_10k": "$1K-$10K",
  "10k_to_100k": "$10K-$100K",
  over_100k: "Over $100K",
  unspecified: "Unspecified",
};

interface DrillDownMiniBarProps {
  data: { name: string; count: number }[];
  dimension: string;
  onBarClick: (dimension: string, value: string) => void;
  canAddFilter: boolean;
}

export function DrillDownMiniBar({
  data,
  dimension,
  onBarClick,
  canAddFilter,
}: DrillDownMiniBarProps) {
  // Sort: push catchall values to bottom, rest by count desc
  const sorted = [...data].sort((a, b) => {
    const aCA = CATCHALL.has(a.name);
    const bCA = CATCHALL.has(b.name);
    if (aCA !== bCA) return aCA ? 1 : -1;
    return b.count - a.count;
  });

  // Top 5 + collapse remainder into "Other"
  let chartData: { name: string; count: number }[];
  if (sorted.length <= 5) {
    chartData = sorted;
  } else {
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const otherCount = rest.reduce((sum, d) => sum + d.count, 0);
    chartData = [...top5, { name: "other", count: otherCount }];
  }

  const formatLabel = (name: string) => {
    if (dimension === "loss_bracket" && LOSS_LABELS[name]) {
      return LOSS_LABELS[name];
    }
    return toTitleCase(name);
  };

  const height = chartData.length * 32 + 16;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 36, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tick={{ fontSize: 11, fill: "#5a5a5a" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatLabel}
        />
        <Tooltip
          cursor={{ fill: "#f6f6f6" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0].payload as { name: string; count: number };
            return (
              <div className="bg-white border border-fog-200 rounded-lg px-3 py-2 shadow-lg">
                <p className="text-sm font-medium text-fog-800">
                  {formatLabel(item.name)}
                </p>
                <p className="text-sm text-fog-500">
                  {formatNumber(item.count)} posts
                </p>
                {canAddFilter && item.name !== "other" && (
                  <p className="text-xs text-ube-600 mt-1">Click to filter</p>
                )}
                {!canAddFilter && (
                  <p className="text-xs text-fog-500 mt-1">
                    Remove a filter to drill deeper
                  </p>
                )}
              </div>
            );
          }}
        />
        <Bar
          dataKey="count"
          radius={[0, 3, 3, 0]}
          barSize={18}
          className={canAddFilter ? "cursor-pointer" : ""}
          onClick={(entry) => {
            if (!canAddFilter || !entry?.name || entry.name === "other") return;
            onBarClick(dimension, String(entry.name));
          }}
          label={{
            position: "right",
            formatter: (v: unknown) => formatNumber(Number(v)),
            fontSize: 11,
            fill: "#787878",
          }}
        >
          {chartData.map((entry, idx) => (
            <Cell
              key={idx}
              fill={CATCHALL.has(entry.name) ? COLOR_MUTED : BAR_COLOR}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
