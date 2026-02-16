"use client";

import { useState } from "react";
import { KPICard } from "@/components/shared/kpi-card";
import { DrillDownPanel } from "@/components/shared/drill-down-panel";
import type { DrillDownConfig } from "@/lib/types/drill-down";
import { formatNumber, toTitleCase } from "@/lib/utils";

interface FraudKPIs {
  totalPosts: number;
  topFraudType: string;
  topFraudTypeCount: number;
  topIndustry: string;
  topIndustryCount: number;
  topChannel: string;
  topChannelCount: number;
}

interface FraudKPIStripProps {
  kpis: FraudKPIs;
}

export function FraudKPIStrip({ kpis }: FraudKPIStripProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Total Posts"
          value={formatNumber(kpis.totalPosts)}
          subtitle="Fraud-related Reddit posts"
        />
        <KPICard
          label="#1 Fraud Type"
          value={toTitleCase(kpis.topFraudType)}
          subtitle={`${formatNumber(kpis.topFraudTypeCount)} posts`}
          onClick={() =>
            setDrillDown({
              type: "fraud",
              dimension: "fraud_type",
              value: kpis.topFraudType,
              title: toTitleCase(kpis.topFraudType),
            })
          }
        />
        <KPICard
          label="Top Industry"
          value={toTitleCase(kpis.topIndustry)}
          subtitle={`${formatNumber(kpis.topIndustryCount)} posts`}
          onClick={() =>
            setDrillDown({
              type: "fraud",
              dimension: "industry",
              value: kpis.topIndustry,
              title: toTitleCase(kpis.topIndustry),
            })
          }
        />
        <KPICard
          label="#1 Attack Channel"
          value={toTitleCase(kpis.topChannel)}
          subtitle={`${formatNumber(kpis.topChannelCount)} posts`}
          onClick={() =>
            setDrillDown({
              type: "fraud",
              dimension: "channel",
              value: kpis.topChannel,
              title: toTitleCase(kpis.topChannel),
            })
          }
        />
      </div>

      <DrillDownPanel config={drillDown} onClose={() => setDrillDown(null)} />
    </>
  );
}
