import type { DrillDownBreakdownItem } from "@/lib/types/drill-down";
import { toTitleCase } from "@/lib/utils";

const DIMENSION_LABELS: Record<string, string> = {
  fraud_type: "fraud type",
  industry: "industry",
  channel: "channel",
  loss_bracket: "loss range",
  friction_type: "friction type",
  platform_name: "platform",
  verification_type: "verification method",
  trigger_reason: "trigger",
  tag: "tag",
  sentiment: "sentiment",
};

const SKIP_VALUES = new Set([
  "other",
  "unknown",
  "unspecified",
  "none",
  "n/a",
]);

function getTopMeaningful(items: DrillDownBreakdownItem[]): {
  name: string;
  percent: number;
} | null {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return null;

  for (const item of items) {
    if (!SKIP_VALUES.has(item.name.toLowerCase())) {
      return { name: item.name, percent: (item.count / total) * 100 };
    }
  }
  return null;
}

interface DrillDownInsightProps {
  breakdowns: Record<string, DrillDownBreakdownItem[]>;
  total: number;
  type: "fraud" | "idv";
}

export function DrillDownInsight({
  breakdowns,
  total,
}: DrillDownInsightProps) {
  if (total < 10) {
    return (
      <p className="text-sm text-fog-600 leading-relaxed">
        This is a small subset ({total} posts). Patterns may not be
        representative.
      </p>
    );
  }

  // Find the most skewed breakdown (highest % for top meaningful value)
  let bestDim: string | null = null;
  let bestTop: { name: string; percent: number } | null = null;

  let secondDim: string | null = null;
  let secondTop: { name: string; percent: number } | null = null;

  for (const [dim, items] of Object.entries(breakdowns)) {
    if (items.length === 0) continue;
    const top = getTopMeaningful(items);
    if (!top) continue;

    if (!bestTop || top.percent > bestTop.percent) {
      // Shift current best to second
      secondDim = bestDim;
      secondTop = bestTop;
      bestDim = dim;
      bestTop = top;
    } else if (!secondTop || top.percent > secondTop.percent) {
      secondDim = dim;
      secondTop = top;
    }
  }

  if (!bestDim || !bestTop) return null;

  const dimLabel = DIMENSION_LABELS[bestDim] || bestDim;

  const secondClause =
    secondDim && secondTop
      ? `, with ${DIMENSION_LABELS[secondDim] || secondDim} led by `
      : "";

  return (
    <p className="text-sm text-fog-600 leading-relaxed">
      The dominant {dimLabel} is{" "}
      <span className="font-semibold text-fog-800">
        {toTitleCase(bestTop.name)}
      </span>{" "}
      ({bestTop.percent.toFixed(0)}%)
      {secondDim && secondTop && (
        <>
          {secondClause}
          <span className="font-semibold text-fog-800">
            {toTitleCase(secondTop.name)}
          </span>{" "}
          ({secondTop.percent.toFixed(0)}%)
        </>
      )}
      .
    </p>
  );
}
