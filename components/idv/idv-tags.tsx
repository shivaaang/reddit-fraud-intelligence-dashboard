"use client";

import { useState } from "react";
import { DrillDownPanel } from "@/components/shared/drill-down-panel";
import type { DrillDownConfig } from "@/lib/types/drill-down";
import { toTitleCase } from "@/lib/utils";

interface TagItem {
  tag: string;
  count: number;
}

interface IdvTagsProps {
  data: TagItem[];
}

const VENDOR_KEYWORDS = [
  "persona",
  "jumio",
  "onfido",
  "id_me",
  "veriff",
  "sumsub",
  "clear",
  "yoti",
  "iproov",
  "au10tix",
  "shufti",
  "socure",
  "plaid",
  "trulioo",
  "mitek",
];

const USER_SITUATION_KEYWORDS = [
  "gig_worker",
  "elderly",
  "expat",
  "immigrant",
  "transgender",
  "underage",
  "minor",
  "teen",
  "student",
  "disabled",
  "homeless",
  "name_change",
  "appearance_change",
  "non_english",
  "rural",
];

const REGULATORY_KEYWORDS = [
  "gdpr",
  "bipa",
  "ccpa",
  "uk_osa",
  "australia",
  "regulation",
  "compliance",
  "legislation",
  "mandate",
  "law",
  "legal",
  "lawsuit",
  "right_to_privacy",
  "consent",
  "opt_out",
];

type TagCategory = "vendor" | "user_situation" | "regulatory" | "process";

function categorizeTag(tag: string): TagCategory {
  const lower = tag.toLowerCase();
  if (VENDOR_KEYWORDS.some((kw) => lower.includes(kw))) return "vendor";
  if (USER_SITUATION_KEYWORDS.some((kw) => lower.includes(kw))) return "user_situation";
  if (REGULATORY_KEYWORDS.some((kw) => lower.includes(kw))) return "regulatory";
  return "process";
}

const CATEGORY_STYLES: Record<
  TagCategory,
  { bg: string; text: string }
> = {
  vendor: { bg: "bg-ube-100", text: "text-ube-1000" },
  user_situation: { bg: "bg-accent-mint", text: "text-fog-800" },
  regulatory: { bg: "bg-red-50", text: "text-red-600" },
  process: { bg: "bg-fog-200", text: "text-fog-700" },
};

export function IdvTags({ data }: IdvTagsProps) {
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
            <span className="text-xs text-fog-500">Vendor</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-accent-mint" />
            <span className="text-xs text-fog-500">User Situation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-50" />
            <span className="text-xs text-fog-500">Regulatory</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-fog-200" />
            <span className="text-xs text-fog-500">Process</span>
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
                    type: "idv",
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
