"use client";

import { formatNumber } from "@/lib/utils";

interface FraudInsightData {
  recoveryVoidCount: number;
  socialEngineeringCount: number;
  organizedCrimeCount: number;
  total: number;
}

interface FraudInsightCardsProps {
  data: FraudInsightData;
}

export function FraudInsightCards({ data }: FraudInsightCardsProps) {
  const cards = [
    {
      title: "The Recovery Void",
      stat: formatNumber(data.recoveryVoidCount),
      statLabel: "posts describe failed recovery",
      narrative:
        "When fraud strikes, victims describe a secondary failure: the inability to recover. Banks refusing chargebacks, platforms offering no escalation path, frozen accounts with no resolution timeline. The fraud event is only half the damage. The institutional response determines the full impact.",
      borderColor: "#e5484d",
    },
    {
      title: "The Human Attack Surface",
      stat: formatNumber(data.socialEngineeringCount),
      statLabel: "social engineering posts",
      narrative:
        "The most devastating fraud exploits human trust, not technical vulnerabilities. Romance scams, pig butchering, and phishing campaigns convince victims to act voluntarily, bypassing every technical control. These attacks resist traditional detection because the victim's behavior appears legitimate.",
      borderColor: "#878cfe",
    },
    {
      title: "Organized Operations",
      stat: formatNumber(data.organizedCrimeCount),
      statLabel: "posts reference coordinated fraud",
      narrative:
        "Beyond individual scammers, the data reveals coordinated fraud operations: money mule networks, cross-border syndicates, and organized rings that treat fraud as a business. These operations exploit jurisdictional gaps at a scale that individual-level detection struggles to address.",
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
