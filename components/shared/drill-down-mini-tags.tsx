"use client";

import { toTitleCase, formatNumber } from "@/lib/utils";

const METHOD_KEYWORDS = [
  "phishing", "deepfake", "social_engineering", "spoofing", "malware",
  "ransomware", "brute_force", "credential_stuffing", "man_in_the_middle",
  "keylogger", "skimming", "vishing", "smishing", "pharming", "baiting",
  "pretexting", "catfishing", "romance", "pig_butchering", "impersonation",
  "synthetic", "forgery", "clone", "spoof", "scam", "fraud", "theft",
  "takeover", "swap", "hijack", "exploit", "ai", "voice_cloning",
  "ai_generated", "ai_voice", "ai_scam",
];

const TARGET_KEYWORDS = [
  "elderly", "senior", "student", "veteran", "immigrant", "minor", "child",
  "teen", "disabled", "vulnerable", "small_business", "consumer", "victim",
  "target",
];

const CHANNEL_KEYWORDS = [
  "online", "phone", "email", "sms", "text", "mail", "in_person", "app",
  "website", "social_media", "marketplace", "payment", "crypto", "wire",
  "gift_card", "atm", "pos", "mobile", "bank", "platform", "exchange",
  "wallet", "transfer", "zelle", "venmo", "cashapp", "paypal", "telegram",
  "whatsapp", "instagram", "facebook", "tiktok", "twitter", "linkedin",
  "dating", "tinder", "amazon", "ebay", "craigslist", "rental",
];

type TagCategory = "method" | "target" | "channel" | "context";

function categorizeTag(tag: string): TagCategory {
  const lower = tag.toLowerCase();
  if (METHOD_KEYWORDS.some((kw) => lower.includes(kw))) return "method";
  if (TARGET_KEYWORDS.some((kw) => lower.includes(kw))) return "target";
  if (CHANNEL_KEYWORDS.some((kw) => lower.includes(kw))) return "channel";
  return "context";
}

const CATEGORY_STYLES: Record<TagCategory, { bg: string; text: string }> = {
  method: { bg: "bg-ube-100", text: "text-ube-1000" },
  target: { bg: "bg-accent-gold", text: "text-fog-800" },
  channel: { bg: "bg-accent-mint", text: "text-fog-800" },
  context: { bg: "bg-fog-200", text: "text-fog-700" },
};

interface DrillDownMiniTagsProps {
  data: { name: string; count: number }[];
  onTagClick: (tag: string) => void;
  canAddFilter: boolean;
}

export function DrillDownMiniTags({
  data,
  onTagClick,
  canAddFilter,
}: DrillDownMiniTagsProps) {
  const tags = data.slice(0, 12);

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((item) => {
        const category = categorizeTag(item.name);
        const styles = CATEGORY_STYLES[category];

        return (
          <button
            key={item.name}
            onClick={() => canAddFilter && onTagClick(item.name)}
            className={`${styles.bg} ${styles.text} text-xs px-2 py-0.5 rounded-full font-medium transition-all duration-150 ${
              canAddFilter
                ? "cursor-pointer hover:shadow-sm hover:scale-105"
                : "cursor-default"
            }`}
          >
            {toTitleCase(item.name)}
            <span className="ml-1 opacity-60">{formatNumber(item.count)}</span>
          </button>
        );
      })}
    </div>
  );
}
