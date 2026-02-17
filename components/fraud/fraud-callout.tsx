"use client";

import { formatNumber } from "@/lib/utils";

interface LossBracketItem {
  name: string;
  count: number;
}

interface FraudCalloutProps {
  midRangeLossCount: number;
  lossBrackets: LossBracketItem[];
}

function formatBracket(name: string): string {
  const labels: Record<string, string> = {
    under_100: "Under $100",
    "100_to_1k": "$100-$1K",
    "1k_to_10k": "$1K-$10K",
    "10k_to_100k": "$10K-$100K",
    over_100k: "Over $100K",
  };
  return labels[name] ?? name;
}

export function FraudCallout({
  midRangeLossCount,
  lossBrackets,
}: FraudCalloutProps) {
  return (
    <div
      className="rounded-xl p-8 text-white shadow-lg"
      style={{
        background:
          "linear-gradient(135deg, #1a1b4b 0%, #010668 60%, #2a2d8a 100%)",
      }}
    >
      <div className="flex items-start justify-between gap-8">
        <div className="flex flex-col gap-3 flex-1">
          <h3 className="text-lg font-bold">
            The Investigation Gap: Where Fraud Losses Fall Through the Cracks
          </h3>
          <p className="text-sm text-white/80 leading-relaxed">
            The majority of reported fraud losses fall in a range that creates a
            systemic blind spot. Amounts between $1K and $10K cause genuine
            financial hardship for individuals, but frequently fall below the
            thresholds that trigger dedicated institutional investigation,
            creating a response vacuum where fraud prevention has the most
            unrealized potential.
          </p>
          <p className="text-xs text-white/60 leading-relaxed mt-1">
            This gap between victim impact and institutional response is where
            proactive fraud detection and identity verification can have the most
            impact: catching fraud before losses reach victims, rather than
            relying on after-the-fact investigation.
          </p>
        </div>

        <div className="flex flex-col items-end flex-shrink-0 gap-4">
          <div className="text-right">
            <span className="text-4xl font-bold">
              {formatNumber(midRangeLossCount)}
            </span>
            <span className="block text-sm text-white/60">
              posts report $1K-$10K losses
            </span>
          </div>

          {lossBrackets && lossBrackets.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {lossBrackets
                .filter(
                  (b) => b.name !== "none" && b.name !== "unspecified"
                )
                .map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 text-right"
                  >
                    <span className="text-xs text-white/50">
                      {formatBracket(item.name)}
                    </span>
                    <span className="text-sm font-semibold text-white/90">
                      {formatNumber(item.count)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
