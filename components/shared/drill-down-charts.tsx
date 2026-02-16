"use client";

import { DrillDownMiniBar } from "./drill-down-mini-bar";
import { DrillDownMiniTags } from "./drill-down-mini-tags";
import { toTitleCase } from "@/lib/utils";

const DIMENSION_LABELS: Record<string, string> = {
  fraud_type: "By Fraud Type",
  industry: "By Industry",
  channel: "By Channel",
  loss_bracket: "By Loss Bracket",
  friction_type: "By Friction Type",
  verification_type: "By Verification Type",
  trigger_reason: "By Trigger Reason",
  platform_name: "By Platform",
  sentiment: "By Sentiment",
  tags: "Top Tags",
};

// Preferred display order per tab. API already excludes the filtered dimension.
const FRAUD_ORDER = ["fraud_type", "industry", "channel", "loss_bracket", "tags"];
const IDV_ORDER = [
  "friction_type",
  "platform_name",
  "verification_type",
  "trigger_reason",
  "sentiment",
  "tags",
];

interface DrillDownChartsProps {
  type: "fraud" | "idv";
  breakdowns: Record<string, { name: string; count: number }[]>;
  onFilterClick: (dimension: string, value: string) => void;
  canAddFilter: boolean;
}

export function DrillDownCharts({
  type,
  breakdowns,
  onFilterClick,
  canAddFilter,
}: DrillDownChartsProps) {
  const order = type === "fraud" ? FRAUD_ORDER : IDV_ORDER;

  // Pick dimensions present in breakdowns, in preferred order, max 4
  const slots = order
    .filter((dim) => breakdowns[dim] && breakdowns[dim].length > 0)
    .slice(0, 4);

  if (slots.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {slots.map((dim) => (
        <div
          key={dim}
          className="bg-white rounded-xl border border-fog-200 p-4"
        >
          <h4 className="text-xs font-semibold text-fog-500 uppercase tracking-wider mb-3">
            {DIMENSION_LABELS[dim] || toTitleCase(dim)}
          </h4>

          {dim === "tags" ? (
            <DrillDownMiniTags
              data={breakdowns[dim]}
              onTagClick={(tag) => onFilterClick("tag", tag)}
              canAddFilter={canAddFilter}
            />
          ) : (
            <DrillDownMiniBar
              data={breakdowns[dim]}
              dimension={dim}
              onBarClick={onFilterClick}
              canAddFilter={canAddFilter}
            />
          )}
        </div>
      ))}
    </div>
  );
}
