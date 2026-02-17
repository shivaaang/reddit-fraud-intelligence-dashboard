"use client";

import { formatNumber } from "@/lib/utils";

interface InsightData {
  ageVerificationCount: number;
  gigWorkerCount: number;
  falseRejectionCount: number;
  falseRejectionPercent: number;
  privacyConcernCount: number;
  noAlternativeCount: number;
  livenessCount: number;
  biometricBreakdown: { type: string; count: number }[];
  total: number;
}

interface IdvInsightCardsProps {
  data: InsightData;
}

export function IdvInsightCards({ data }: IdvInsightCardsProps) {
  const cards = [
    {
      title: "Age Verification Wave",
      stat: formatNumber(data.ageVerificationCount),
      statLabel: "age-related posts",
      narrative:
        "Age gates are the new verification frontier. Platforms are rolling out age estimation and document checks, creating a fresh wave of friction for legitimate users.",
      borderColor: "#010668",
    },
    {
      title: "Gig Workers Under Scrutiny",
      stat: formatNumber(data.gigWorkerCount),
      statLabel: "gig platform posts",
      narrative:
        "Drivers and couriers face repeated identity checks that interrupt their livelihood. Uber, Lyft, and DoorDash are among the most-mentioned platforms for verification failures.",
      borderColor: "#878cfe",
    },
    {
      title: "Privacy & Consent Resistance",
      stat: formatNumber(data.privacyConcernCount),
      statLabel: "privacy-concern posts",
      narrative:
        "Users are pushing back against handing over government IDs and biometric data. As data protection regulations tighten globally, balancing thorough verification with user consent is becoming a defining challenge.",
      borderColor: "#010668",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white rounded-xl border border-fog-200 shadow-sm p-6 flex flex-col gap-3"
          style={{ borderTopWidth: 3, borderTopColor: card.borderColor }}
        >
          <h3 className="text-base font-bold text-fog-800">{card.title}</h3>
          <div>
            <span className="text-2xl font-bold text-fog-800">
              {card.stat}
            </span>
            <span className="text-sm text-fog-500 ml-2">{card.statLabel}</span>
          </div>
          <p className="text-sm text-fog-600 leading-relaxed">
            {card.narrative}
          </p>
        </div>
      ))}
    </div>
  );
}
