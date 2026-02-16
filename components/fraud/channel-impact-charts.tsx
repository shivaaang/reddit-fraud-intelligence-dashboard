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

interface ChartItem {
  name: string;
  count: number;
}

interface ChannelImpactChartsProps {
  channelData: ChartItem[];
  lossData: ChartItem[];
}

const COLOR_CHANNEL = "#878cfe";
const COLOR_MUTED = "#d3d5ff";
const LOSS_COLORS: Record<string, string> = {
  none: "#b7efda",         // mint green, no loss
  under_100: "#93c5a8",    // light green-gray
  "100_to_1k": "#e5944b",  // warm amber
  "1k_to_10k": "#d97a33",  // deeper amber
  "10k_to_100k": "#c43e3e", // red
  over_100k: "#9c2020",    // dark red
  unspecified: "#d4d4d4",  // gray
};
const COLOR_LOSS_DEFAULT = "#e5944b";

function formatLossBracket(name: string): string {
  const labels: Record<string, string> = {
    none: "No Loss",
    under_100: "Under $100",
    "100_to_1k": "$100 - $1K",
    "1k_to_10k": "$1K - $10K",
    "10k_to_100k": "$10K - $100K",
    over_100k: "Over $100K",
    unspecified: "Unspecified",
  };
  return labels[name] ?? toTitleCase(name);
}

export function ChannelImpactCharts({
  channelData,
  lossData,
}: ChannelImpactChartsProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  const channelSorted = [...channelData].sort((a, b) => {
    const aOther = a.name === "other";
    const bOther = b.name === "other";
    if (aOther !== bOther) return aOther ? 1 : -1;
    return b.count - a.count;
  });

  const channelChartData = channelSorted.map((d) => ({
    ...d,
    displayName: toTitleCase(d.name),
  }));

  const lossChartData = lossData.map((d) => ({
    ...d,
    displayName: formatLossBracket(d.name),
  }));

  const chartHeight = (items: unknown[]) => items.length * 44 + 20;

  return (
    <>
      <div className="grid grid-cols-2 gap-6">
        {/* Channel Distribution */}
        <div className="bg-white rounded-xl border border-fog-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-fog-600 uppercase tracking-wider mb-4">
            Digital Attack Surface
          </h3>
          <ResponsiveContainer
            width="100%"
            height={chartHeight(channelChartData)}
          >
            <BarChart
              data={channelChartData}
              layout="vertical"
              margin={{ top: 0, right: 40, bottom: 0, left: 120 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="displayName"
                width={120}
                tick={{ fontSize: 13, fill: "#2b2b2b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "#f6f6f6" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as ChartItem & {
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
                    dimension: "channel",
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
                {channelChartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.name === "other" ? COLOR_MUTED : COLOR_CHANNEL}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Loss Bracket Distribution */}
        <div className="bg-white rounded-xl border border-fog-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-fog-600 uppercase tracking-wider mb-4">
            Financial Impact
          </h3>
          <ResponsiveContainer
            width="100%"
            height={chartHeight(lossChartData)}
          >
            <BarChart
              data={lossChartData}
              layout="vertical"
              margin={{ top: 0, right: 40, bottom: 0, left: 120 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="displayName"
                width={120}
                tick={{ fontSize: 13, fill: "#2b2b2b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "#f6f6f6" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as ChartItem & {
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
                    dimension: "loss_bracket",
                    value: String(entry.name),
                    title: formatLossBracket(String(entry.name)),
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
                {lossChartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={LOSS_COLORS[entry.name] ?? COLOR_LOSS_DEFAULT}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DrillDownPanel config={drillDown} onClose={() => setDrillDown(null)} />
    </>
  );
}
