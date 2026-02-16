"use client";

import { formatNumber, formatPercent } from "@/lib/utils";
import { MessageSquareWarning, UserX } from "lucide-react";

interface BridgeBannerProps {
  totalPosts: number;
  negativeSentimentPercent: number;
}

export function BridgeBanner({
  totalPosts,
  negativeSentimentPercent,
}: BridgeBannerProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      {/* Left: Scale of posts */}
      <div
        className="rounded-xl border border-ube-300 px-6 py-5 flex items-start gap-4"
        style={{
          background: "linear-gradient(135deg, #e9eaff 0%, #d3d5ff 100%)",
        }}
      >
        <MessageSquareWarning className="w-8 h-8 text-ube-1000 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-2xl font-bold text-ube-1000">
            {formatNumber(totalPosts)}
          </p>
          <p className="text-sm font-medium text-fog-700 mt-1">
            identity verification posts
          </p>
          <p className="text-xs text-fog-500 mt-1.5 leading-relaxed">
            Real Reddit discussions about identity verification friction, from
            false rejections to privacy concerns to excessive re-checks.
          </p>
        </div>
      </div>

      {/* Center connector */}
      <div className="flex flex-col items-center gap-1 px-2">
        <div className="w-px h-6 bg-fog-300" />
        <span className="text-xs text-fog-500 font-medium text-center leading-tight max-w-[120px]">
          the core tension
        </span>
        <div className="w-px h-6 bg-fog-300" />
      </div>

      {/* Right: User friction */}
      <div
        className="rounded-xl border border-ube-300 px-6 py-5 flex items-start gap-4"
        style={{
          background: "linear-gradient(135deg, #e9eaff 0%, #d3d5ff 100%)",
        }}
      >
        <UserX className="w-8 h-8 text-chart-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-2xl font-bold text-chart-warning">
            {formatPercent(negativeSentimentPercent)}
          </p>
          <p className="text-sm font-medium text-fog-700 mt-1">
            express negative sentiment
          </p>
          <p className="text-xs text-fog-500 mt-1.5 leading-relaxed">
            Verification that blocks legitimate users erodes trust and drives
            workarounds that weaken security.
          </p>
        </div>
      </div>
    </div>
  );
}
