import type { DrillDownQuote as QuoteType } from "@/lib/types/drill-down";

interface DrillDownQuoteProps {
  quote: QuoteType | null;
  type: "fraud" | "idv";
}

export function DrillDownQuote({ quote, type }: DrillDownQuoteProps) {
  if (!quote) return null;

  const borderColor =
    type === "fraud" ? "border-l-ube-400" : "border-l-red-400";

  return (
    <div className={`border-l-4 ${borderColor} bg-fog-100 rounded-lg p-5 pl-6`}>
      <p className="text-sm text-fog-700 italic leading-relaxed line-clamp-3">
        &ldquo;{quote.text}&rdquo;
      </p>
      <p className="text-xs text-fog-500 mt-2 text-right">
        &mdash; r/{quote.subreddit} &middot; Score: {quote.score}
      </p>
    </div>
  );
}
