"use client";

import { toTitleCase } from "@/lib/utils";

interface QuoteItem {
  quote: string;
  frictionType: string;
  platform: string | null;
  subreddit: string;
  score: number;
}

interface IdvVoicesProps {
  quotes: QuoteItem[];
}

export function IdvVoices({ quotes }: IdvVoicesProps) {
  // Pick 6 quotes with friction type diversity: best per type, then fill by score
  const sorted = [...quotes].sort((a, b) => b.score - a.score);
  const displayed: QuoteItem[] = [];
  const seenTypes = new Set<string>();

  for (const q of sorted) {
    if (displayed.length >= 6) break;
    const typeKey = q.frictionType === "none" ? "__none__" : q.frictionType;
    if (!seenTypes.has(typeKey)) {
      displayed.push(q);
      seenTypes.add(typeKey);
    }
  }
  for (const q of sorted) {
    if (displayed.length >= 6) break;
    if (!displayed.includes(q)) displayed.push(q);
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {displayed.map((q, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl border border-fog-200 shadow-sm border-l-4 p-5 flex flex-col gap-3"
          style={{ borderLeftColor: "#e5484d" }}
        >
          <p className="text-sm text-fog-700 italic leading-relaxed">
            &ldquo;{q.quote}&rdquo;
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600">
              {toTitleCase(q.frictionType === "none" ? "general" : q.frictionType)}
            </span>
            {q.platform && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-ube-100 text-ube-1000">
                {q.platform}
              </span>
            )}
            <span className="text-xs text-fog-500 ml-auto">
              r/{q.subreddit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
