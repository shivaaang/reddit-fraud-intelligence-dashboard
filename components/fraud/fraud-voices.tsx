"use client";

import { toTitleCase, formatNumber } from "@/lib/utils";

interface Quote {
  quote: string;
  fraudType: string;
  subreddit: string;
  score: number;
}

interface FraudVoicesProps {
  quotes: Quote[];
  aiThreatCount: number;
}

export function FraudVoices({ quotes, aiThreatCount }: FraudVoicesProps) {
  // Pick 3 quotes with fraud type diversity: best quote per unique type, then fill by score
  const sorted = [...quotes].sort((a, b) => b.score - a.score);
  const topQuotes: Quote[] = [];
  const seenTypes = new Set<string>();

  // First pass: one quote per fraud type
  for (const q of sorted) {
    if (topQuotes.length >= 3) break;
    if (!seenTypes.has(q.fraudType)) {
      topQuotes.push(q);
      seenTypes.add(q.fraudType);
    }
  }
  // Fill remaining slots by score if needed
  for (const q of sorted) {
    if (topQuotes.length >= 3) break;
    if (!topQuotes.includes(q)) topQuotes.push(q);
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {topQuotes.map((q, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl border border-fog-200 shadow-sm p-5 flex flex-col justify-between border-l-4 border-l-ube-600"
        >
          <blockquote className="text-sm text-fog-700 italic leading-relaxed mb-4">
            &ldquo;{q.quote}&rdquo;
          </blockquote>
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-ube-100 text-ube-1000">
              {toTitleCase(q.fraudType)}
            </span>
            <span className="text-xs text-fog-500">
              r/{q.subreddit}
            </span>
          </div>
        </div>
      ))}

      {/* AI Threats Insight Card */}
      <div className="bg-ube-1100 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <p className="text-xs font-semibold text-ube-300 uppercase tracking-wider mb-2">
            Emerging Threat
          </p>
          <p className="text-3xl font-bold text-white mb-2">
            {formatNumber(aiThreatCount)}
          </p>
          <p className="text-sm font-medium text-ube-200 mb-3">
            posts mention AI-powered fraud
          </p>
        </div>
        <p className="text-xs text-ube-300 leading-relaxed">
          Deepfakes, AI-generated voices, and synthetic identities are
          accelerating fraud sophistication. These posts signal a growing need
          for advanced identity verification that can detect AI-manipulated
          documents and biometrics.
        </p>
      </div>
    </div>
  );
}
