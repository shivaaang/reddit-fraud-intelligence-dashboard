"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function MethodologySection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-fog-500 hover:text-fog-700 transition-colors mx-auto"
      >
        About this analysis
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {open && (
        <div className="mt-4 max-w-2xl mx-auto text-left space-y-3 text-xs text-fog-500 leading-relaxed">
          <div>
            <span className="font-semibold text-fog-600">Data source:</span>{" "}
            40,316 public Reddit posts from 2025, collected from 25+ fraud,
            identity verification, and security-focused subreddits.
          </div>
          <div>
            <span className="font-semibold text-fog-600">Pipeline:</span>{" "}
            Two-pass classification. Pass 1: boolean routing (is_fraud /
            is_idv) across all posts. Pass 2: deep structured classification
            with validated output for fraud type, industry, loss bracket,
            channel, verification type, friction type, trigger reason, platform,
            and sentiment.
          </div>
          <div>
            <span className="font-semibold text-fog-600">Scope:</span> 8,739
            fraud-relevant posts and 7,720 IDV-relevant posts after relevance
            filtering, with 2,154 posts classified in both categories.
          </div>
          <div>
            <span className="font-semibold text-fog-600">Limitations:</span>{" "}
            Reddit data skews toward English-speaking, tech-savvy users.
            Complaint-driven data overrepresents negative experiences. Loss
            amounts are self-reported and may not reflect actual financial
            impact. Platform mentions reflect Reddit user demographics, not
            market share.
          </div>
        </div>
      )}
    </div>
  );
}
