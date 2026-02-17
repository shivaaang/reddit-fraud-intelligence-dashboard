import { Lightbulb } from "lucide-react";

interface Recommendation {
  headline: string;
  dataPoint: string;
  recommendation: string;
  accentColor: string;
}

interface RecommendationsSectionProps {
  title: string;
  cards: Recommendation[];
}

export function RecommendationsSection({
  title,
  cards,
}: RecommendationsSectionProps) {
  return (
    <div className="mt-2">
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="w-5 h-5 text-ube-600" />
        <h3 className="text-lg font-bold text-fog-900">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div
            key={card.headline}
            className="rounded-xl border border-fog-200 shadow-sm bg-white p-6 flex flex-col gap-3"
            style={{ borderTopWidth: 3, borderTopColor: card.accentColor }}
          >
            <h4 className="text-sm font-bold text-fog-900">
              {card.headline}
            </h4>
            <p className="text-xs text-fog-500 leading-relaxed">
              {card.dataPoint}
            </p>
            <p className="text-sm text-fog-700 leading-relaxed">
              {card.recommendation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
