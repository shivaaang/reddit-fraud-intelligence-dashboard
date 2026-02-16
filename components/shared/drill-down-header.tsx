"use client";

import { X } from "lucide-react";
import { formatNumber, toTitleCase } from "@/lib/utils";

const DIMENSION_LABELS: Record<string, string> = {
  fraud_type: "Fraud Type",
  industry: "Industry",
  channel: "Channel",
  loss_bracket: "Loss",
  friction_type: "Friction",
  platform_name: "Platform",
  verification_type: "Verification",
  trigger_reason: "Trigger",
  tag: "Tag",
  sentiment: "Sentiment",
};

interface DrillDownHeaderProps {
  type: "fraud" | "idv";
  dimension: string;
  value: string;
  total: number;
  tabTotal: number;
  percent: number;
  sentimentPercent?: number;
  secondaryFilter?: { dimension: string; value: string } | null;
  onRemoveSecondary: () => void;
  onClose: () => void;
}

export function DrillDownHeader({
  type,
  dimension,
  value,
  total,
  tabTotal,
  percent,
  sentimentPercent,
  secondaryFilter,
  onRemoveSecondary,
  onClose,
}: DrillDownHeaderProps) {
  const contextLabel =
    type === "fraud"
      ? "fraud-related posts"
      : "identity verification posts";
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-fog-200 px-6 py-5">
      {/* Row 1: Badge + Title + Close */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-ube-100 text-ube-1000">
          {DIMENSION_LABELS[dimension] || toTitleCase(dimension)}
        </span>
        <h2 className="text-xl font-bold text-fog-900 flex-1">
          {toTitleCase(value)}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="p-2 rounded-lg hover:bg-fog-100 transition-colors -mr-2"
        >
          <X className="w-5 h-5 text-fog-500" />
        </button>
      </div>

      {/* Row 2: Stats */}
      <p className="text-sm text-fog-500 mt-1.5">
        {formatNumber(total)} of {formatNumber(tabTotal)} {contextLabel} ({percent.toFixed(1)}%)
        {sentimentPercent != null && (
          <> &middot; {sentimentPercent.toFixed(0)}% negative sentiment</>
        )}
      </p>

      {/* Row 3: Filter chips (secondary filter) */}
      {secondaryFilter && (
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-ube-100 text-ube-1000 flex items-center gap-1.5">
            {DIMENSION_LABELS[secondaryFilter.dimension] ||
              toTitleCase(secondaryFilter.dimension)}
            : {toTitleCase(secondaryFilter.value)}
            <button
              onClick={onRemoveSecondary}
              aria-label="Remove filter"
              className="hover:text-ube-1000/70 transition-colors"
            >
              &times;
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
