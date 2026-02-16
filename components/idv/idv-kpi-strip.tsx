"use client";

import { useState } from "react";
import { KPICard } from "@/components/shared/kpi-card";
import { DrillDownPanel } from "@/components/shared/drill-down-panel";
import type { DrillDownConfig } from "@/lib/types/drill-down";
import { formatNumber, formatPercent, toTitleCase } from "@/lib/utils";

interface IdvKPIs {
  totalPosts: number;
  topFrictionType: string;
  topFrictionCount: number;
  negativeSentimentPercent: number;
  topPlatform: string;
  topPlatformCount: number;
}

interface IdvKPIStripProps {
  kpis: IdvKPIs;
}

export function IdvKPIStrip({ kpis }: IdvKPIStripProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Total IDV Posts"
          value={formatNumber(kpis.totalPosts)}
          subtitle="Identity verification discussions"
        />
        <KPICard
          label="#1 Friction Type"
          value={toTitleCase(kpis.topFrictionType)}
          subtitle={`${formatNumber(kpis.topFrictionCount)} posts`}
          onClick={() =>
            setDrillDown({
              type: "idv",
              dimension: "friction_type",
              value: kpis.topFrictionType,
              title: toTitleCase(kpis.topFrictionType),
            })
          }
        />
        <KPICard
          label="Negative Sentiment"
          value={formatPercent(kpis.negativeSentimentPercent)}
          subtitle="Of all IDV discussions"
          onClick={() =>
            setDrillDown({
              type: "idv",
              dimension: "sentiment",
              value: "negative",
              title: "Negative Sentiment",
            })
          }
        />
        <KPICard
          label="Top Platform"
          value={toTitleCase(kpis.topPlatform)}
          subtitle={`${formatNumber(kpis.topPlatformCount)} posts`}
          onClick={() =>
            setDrillDown({
              type: "idv",
              dimension: "platform_name",
              value: kpis.topPlatform,
              title: kpis.topPlatform,
            })
          }
        />
      </div>

      <DrillDownPanel config={drillDown} onClose={() => setDrillDown(null)} />
    </>
  );
}
