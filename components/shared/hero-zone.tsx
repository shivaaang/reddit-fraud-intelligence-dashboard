import { formatNumber } from "@/lib/utils";

interface SubredditItem {
  name: string;
  count: number;
}

interface HeroZoneProps {
  type: "fraud" | "idv";
  totalPosts: number;
  topSubreddits: SubredditItem[];
}

export function HeroZone({ type, totalPosts, topSubreddits }: HeroZoneProps) {
  const description =
    type === "fraud"
      ? "public Reddit posts that discuss or mention fraud"
      : "public Reddit posts that discuss or mention identity verification";

  return (
    <div className="bg-gradient-to-b from-[#f0f0f8] to-fog-100 pb-4 -mx-8 px-8 -mt-6 pt-6 -mb-2">
      <div className="flex items-start gap-8">
        {/* Left: Dataset description */}
        <div className="flex-1">
          <p className="text-xs font-medium text-fog-500 uppercase tracking-widest mb-3">
            Dataset
          </p>
          <p className="text-[15px] text-fog-700 leading-relaxed">
            Analyzed{" "}
            <span className="text-2xl font-bold text-fog-900">
              {formatNumber(totalPosts)}
            </span>{" "}
            {description}, collected from January 2025 onwards.
          </p>
        </div>

        {/* Right: Top subreddits */}
        <div className="flex-shrink-0">
          <p className="text-xs font-medium text-fog-500 uppercase tracking-widest mb-3">
            Top Communities
          </p>
          <div className="flex flex-wrap gap-2">
            {topSubreddits.map((sub) => (
              <span
                key={sub.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ube-100 text-xs font-medium text-ube-1000"
              >
                r/{sub.name}
                <span className="text-ube-400">
                  {formatNumber(sub.count)}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
