import { Suspense } from "react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { FraudTab } from "@/components/fraud/fraud-tab";
import { IdvTab } from "@/components/idv/idv-tab";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <DashboardShell
      fraudTab={
        <Suspense fallback={<TabSkeleton />}>
          <FraudTab />
        </Suspense>
      }
      idvTab={
        <Suspense fallback={<TabSkeleton />}>
          <IdvTab />
        </Suspense>
      }
    />
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI strip skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-fog-200 rounded-xl" />
        ))}
      </div>
      {/* Chart skeletons */}
      <div className="h-72 bg-fog-200 rounded-xl" />
      <div className="h-72 bg-fog-200 rounded-xl" />
    </div>
  );
}
