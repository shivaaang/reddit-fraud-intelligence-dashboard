"use client";

import { useState } from "react";
import { DrillDownPanel } from "@/components/shared/drill-down-panel";
import type { DrillDownConfig } from "@/lib/types/drill-down";
import { toTitleCase } from "@/lib/utils";

interface TagItem {
  tag: string;
  count: number;
}

interface FraudTagsProps {
  data: TagItem[];
}

const METHOD_KEYWORDS = [
  "phishing",
  "deepfake",
  "social_engineering",
  "spoofing",
  "malware",
  "ransomware",
  "brute_force",
  "credential_stuffing",
  "man_in_the_middle",
  "keylogger",
  "skimming",
  "vishing",
  "smishing",
  "pharming",
  "baiting",
  "pretexting",
  "catfishing",
  "romance",
  "pig_butchering",
  "impersonation",
  "synthetic",
  "forgery",
  "clone",
  "spoof",
  "scam",
  "fraud",
  "theft",
  "takeover",
  "swap",
  "hijack",
  "exploit",
  "ai",
  "voice_cloning",
  "ai_generated",
  "ai_voice",
  "ai_scam",
];

const TARGET_KEYWORDS = [
  "elderly",
  "senior",
  "student",
  "veteran",
  "immigrant",
  "minor",
  "child",
  "teen",
  "disabled",
  "vulnerable",
  "small_business",
  "consumer",
  "victim",
  "target",
];

const CONTEXT_KEYWORDS = [
  "financial_loss",
  "emotional",
  "recovery",
  "account_locked",
  "customer_support",
  "support_failure",
  "no_recourse",
  "repeat",
  "recurring",
  "unreported",
  "cross_border",
  "international",
  "law_enforcement",
  "police",
  "fbi",
  "report",
  "chargeback",
  "refund",
  "insurance",
  "dispute",
  "bank_response",
  "platform_response",
  "awareness",
  "education",
  "prevention",
  "warning",
  "urgent",
  "verified",
  "unverified",
  "automated",
  "manual",
  "high_volume",
  "organized",
  "sophisticated",
  "simple",
  "ongoing",
  "resolved",
  "unresolved",
  "escalat",
  "complaint",
  "negligence",
  "liability",
  "regulatory",
  "compliance",
  "data_breach",
  "breach",
  "exposure",
  "leak",
  "privacy",
  "dark_web",
  "underground",
];

const CHANNEL_KEYWORDS = [
  "online",
  "phone",
  "email",
  "sms",
  "text",
  "mail",
  "in_person",
  "app",
  "website",
  "social_media",
  "marketplace",
  "payment",
  "crypto",
  "wire",
  "gift_card",
  "atm",
  "pos",
  "mobile",
  "bank",
  "platform",
  "exchange",
  "wallet",
  "transfer",
  "zelle",
  "venmo",
  "cashapp",
  "paypal",
  "telegram",
  "whatsapp",
  "instagram",
  "facebook",
  "tiktok",
  "twitter",
  "linkedin",
  "dating",
  "tinder",
  "amazon",
  "ebay",
  "craigslist",
  "rental",
];

type TagCategory = "method" | "target" | "channel" | "context";

function categorizeTag(tag: string): TagCategory {
  const lower = tag.toLowerCase();
  if (METHOD_KEYWORDS.some((kw) => lower.includes(kw))) return "method";
  if (TARGET_KEYWORDS.some((kw) => lower.includes(kw))) return "target";
  if (CONTEXT_KEYWORDS.some((kw) => lower.includes(kw))) return "context";
  if (CHANNEL_KEYWORDS.some((kw) => lower.includes(kw))) return "channel";
  return "context"; // fallback to context instead of channel
}

const CATEGORY_STYLES: Record<
  TagCategory,
  { bg: string; text: string }
> = {
  method: { bg: "bg-ube-100", text: "text-ube-1000" },
  target: { bg: "bg-accent-gold", text: "text-fog-800" },
  channel: { bg: "bg-accent-mint", text: "text-fog-800" },
  context: { bg: "bg-fog-200", text: "text-fog-700" },
};

export function FraudTags({ data }: FraudTagsProps) {
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  const displayTags = data.slice(0, 40);

  // Calculate relative sizing based on count range
  const maxCount = Math.max(...displayTags.map((t) => t.count), 1);
  const minCount = Math.min(...displayTags.map((t) => t.count), 1);

  function getScale(count: number): number {
    if (maxCount === minCount) return 1;
    // Scale from 0.75 to 1.35
    return 0.75 + ((count - minCount) / (maxCount - minCount)) * 0.6;
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-fog-200 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-ube-100" />
            <span className="text-xs text-fog-500">Method</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-accent-gold" />
            <span className="text-xs text-fog-500">Target</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-accent-mint" />
            <span className="text-xs text-fog-500">Channel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-fog-200" />
            <span className="text-xs text-fog-500">Context</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {displayTags.map((item) => {
            const category = categorizeTag(item.tag);
            const styles = CATEGORY_STYLES[category];
            const scale = getScale(item.count);

            return (
              <button
                key={item.tag}
                onClick={() =>
                  setDrillDown({
                    type: "fraud",
                    dimension: "tag",
                    value: item.tag,
                    title: toTitleCase(item.tag),
                  })
                }
                className={`${styles.bg} ${styles.text} rounded-full font-medium hover:shadow-sm hover:scale-105 transition-all duration-150 cursor-pointer`}
                style={{
                  fontSize: `${scale * 0.875}rem`,
                  padding: `${scale * 0.25}rem ${scale * 0.75}rem`,
                }}
              >
                {toTitleCase(item.tag)}
                <span className="ml-1.5 opacity-60">{item.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <DrillDownPanel config={drillDown} onClose={() => setDrillDown(null)} />
    </>
  );
}
