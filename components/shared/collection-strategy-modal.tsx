"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";

interface CollectionStrategyModalProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL_SHOW = 8;

const categories = [
  {
    name: "Fraud Communities",
    description: "Direct collection from high-density fraud subreddits",
    tags: [
      "r/Scams",
      "r/identitytheft",
      "r/fraud",
      "r/SocialEngineering",
      "r/netsec",
      "identity theft",
      "deepfake",
      "synthetic identity",
      "account takeover",
      "SIM swap",
      "phishing",
      "social engineering",
      "romance scam",
      "investment scam",
      "pig butchering",
      "impersonation",
      "money mule",
    ],
  },
  {
    name: "Cross-Reddit Fraud Searches",
    description: "Global keyword searches targeting fraud across all subreddits",
    tags: [
      "identity stolen what do I do",
      "someone opened account in my name",
      "my identity was stolen",
      "identity theft report",
      "deepfake scam",
      "deepfake fraud",
      "AI generated fake identity",
      "synthetic identity fraud",
      "account takeover bank",
      "SIM swap attack",
      "phishing stolen credentials",
      "business email compromise",
      "romance scam money",
      "biometric spoofing",
      "liveness detection bypass",
      "face swap verification",
      "fake ID online order",
      "verification bypass",
    ],
  },
  {
    name: "Fraud Techniques & Attack Vectors",
    description: "Targeted searches for specific fraud methods and emerging threats",
    tags: [
      "synthetic identity",
      "mule account fraud",
      "money mule",
      "AI generated fake ID",
      "camera injection attack",
      "credential stuffing",
      "port out scam",
      "identity fraud as a service",
      "pretexting",
      "vishing",
      "verification loop stuck",
      "manual review stuck",
      "name mismatch verification",
      "account recovery verify identity",
    ],
  },
  {
    name: "IDV Provider Experience",
    description: "Verification experience searches for IDV companies",
    tags: [
      "Jumio",
      "Onfido",
      "Veriff",
      "ID.me",
      "Sumsub",
      "Mitek",
      "iProov",
      "Au10tix",
      "Trulioo",
      "CLEAR",
      "Plaid",
      "Socure",
      "Entrust",
      "Shufti Pro",
      "Persona verification",
    ],
  },
  {
    name: "KYC & Verification Friction",
    description: "Searches targeting verification failure and user frustration",
    tags: [
      "KYC failed my account",
      "identity verification keeps failing",
      "can't verify my identity",
      "selfie verification not working",
      "document rejected verification",
      "ID verification frustrating",
      "why do I need to verify my identity",
      "verification privacy concern",
      "AML check blocked my account",
      "bank froze account verification",
      "identity verification took too long",
      "KYC verification rejected",
      "verification selfie failed",
      "account locked identity verification",
      "identity verification data breach",
      "forced to upload ID",
      "onboarding identity check",
      "remote identity verification",
      "enhanced due diligence",
    ],
  },
  {
    name: "Social Media Platforms",
    description: "Verification searches across social media platforms",
    tags: [
      "Facebook",
      "Instagram",
      "TikTok",
      "YouTube",
      "LinkedIn",
      "Discord",
      "Snapchat",
      "Twitter",
      "Reddit",
      "Airbnb",
      "Amazon",
      "eBay",
      "r/facebookdisabledme",
      "r/FixMyInstagram",
      "selfie verification",
      "video verification",
      "upload ID",
      "account disabled verify",
      "age verification",
    ],
  },
  {
    name: "Fintech & Crypto",
    description: "Verification searches across financial and cryptocurrency platforms",
    tags: [
      "PayPal",
      "Venmo",
      "Coinbase",
      "Binance",
      "Kraken",
      "Chime",
      "Zelle",
      "Cash App",
      "Robinhood",
      "Revolut",
      "Wise",
      "Crypto.com",
      "PiNetwork",
      "r/CryptoMarkets",
      "r/BitcoinBeginners",
      "r/binance",
      "r/Coinbase",
      "exchange verification failed",
    ],
  },
  {
    name: "Gig Economy & Freelancing",
    description:
      "Verification and deactivation searches across gig and freelance platforms",
    tags: [
      "Uber",
      "Lyft",
      "DoorDash",
      "Instacart",
      "Amazon Flex",
      "Grubhub",
      "Shipt",
      "Spark",
      "Upwork",
      "Fiverr",
      "r/doordash_drivers",
      "r/uberdrivers",
      "r/InstacartShoppers",
      "r/Sparkdriver",
      "r/UberEatsDrivers",
      "deactivated",
      "Checkr",
      "background check",
    ],
  },
  {
    name: "Persona Client Platforms",
    description: "Verification experience for known Persona client companies",
    tags: [
      "OpenAI verify identity",
      "ChatGPT age verification",
      "DoorDash ID verification",
      "DoorDash dasher verify",
      "Cash App verify identity",
      "Cash App KYC",
      "Carvana verify identity",
      "Coursera verify identity",
      "Square verify identity",
      "Robinhood verify identity",
      "Revolut KYC failed",
      "Wise verify identity",
      "Kraken verify identity",
      "Crypto.com verify identity",
    ],
  },
  {
    name: "Government & Public Sector",
    description: "Verification searches across government identity systems",
    tags: [
      "r/IRS",
      "r/SocialSecurity",
      "r/VeteransBenefits",
      "r/Unemployment",
      "r/legaladvice",
      "verify identity IRS",
      "Login.gov",
      "Login.gov identity verification failed",
      "EDD identity verification",
      "SSA verify identity",
      "government ID verification",
      "Real ID verification",
      "unemployment identity fraud",
      "TSA PreCheck verification",
      "5071C letter",
      "5747C letter",
    ],
  },
  {
    name: "Gaming & Age Verification",
    description: "Age and identity verification in gaming and AI platforms",
    tags: [
      "r/Roblox",
      "r/RobloxHelp",
      "r/CharacterAI",
      "r/FACEITcom",
      "r/FortNiteBR",
      "r/ChatGPT",
      "r/OpenAI",
      "r/technology",
      "age verification",
      "verify age",
      "ID check",
      "facial recognition",
    ],
  },
  {
    name: "Dating, Gambling & Niche Verticals",
    description: "Verification searches across dating, gambling, and other verticals",
    tags: [
      "r/Tinder",
      "r/Bumble",
      "r/OnlineDating",
      "r/DraftKings",
      "r/fanduel",
      "r/sportsbook",
      "dating app verification",
      "catfish verified profile",
      "fake verified profile",
      "online casino KYC",
      "sports betting verify identity",
      "telehealth identity verification",
      "rental application identity theft",
      "tenant screening fraud",
      "online exam identity verification",
      "proctoring identity check",
    ],
  },
  {
    name: "Privacy, Bias & Accessibility",
    description: "Searches targeting verification equity and privacy concerns",
    tags: [
      "r/privacy",
      "biometric KYC privacy",
      "face scan privacy concern",
      "selfie verification privacy",
      "facial recognition bias",
      "identity verification disabled",
      "identity verification no ID",
      "accessibility KYC",
      "biometric data breach",
      "identity verification dark skin",
      "elderly identity verification",
      "blind identity verification",
      "refuse upload ID verification",
      "data retention selfie ID scan",
    ],
  },
];

export function CollectionStrategyModal({
  open,
  onClose,
}: CollectionStrategyModalProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (!open) return null;

  function toggleCategory(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto modal-enter">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-fog-200 px-6 py-5 flex items-start justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-fog-900">
              Data Collection Strategy
            </h2>
            <p className="text-sm text-fog-500 mt-0.5">
              Structured search strategy across Reddit communities
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-fog-400 hover:text-fog-700 hover:bg-fog-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories */}
        <div className="px-6 py-5 space-y-6">
          {categories.map((category, i) => {
            const isExpanded = expanded.has(i);
            const visibleTags = isExpanded
              ? category.tags
              : category.tags.slice(0, INITIAL_SHOW);
            const hasMore = category.tags.length > INITIAL_SHOW;
            const hiddenCount = category.tags.length - INITIAL_SHOW;

            return (
              <div key={category.name}>
                <h3 className="text-base font-semibold text-fog-800">
                  {category.name}
                </h3>
                <p className="text-sm text-fog-500 mt-0.5">
                  {category.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {visibleTags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-sm px-2.5 py-1 rounded-full ${
                        tag.startsWith("r/")
                          ? "bg-ube-100 text-ube-1000 font-medium"
                          : "bg-fog-100 text-fog-700"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                  {hasMore && (
                    <button
                      onClick={() => toggleCategory(i)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-ube-400 hover:text-ube-1000 transition-colors px-2 py-1"
                    >
                      {isExpanded ? (
                        <>
                          Show less
                          <ChevronUp className="w-3 h-3" />
                        </>
                      ) : (
                        <>
                          +{hiddenCount} more
                          <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-6 pb-5">
          <div className="bg-fog-100 rounded-lg px-4 py-3">
            <p className="text-sm text-fog-500 leading-relaxed">
              Each search was paginated up to 1,000 results and filtered to
              posts from the past 12 months. Subreddit-specific searches
              combined targeted keywords with subreddit context for higher
              relevance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
