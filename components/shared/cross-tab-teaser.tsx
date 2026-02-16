"use client";

import { ArrowRight, Fingerprint } from "lucide-react";

export function CrossTabTeaser() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("switch-tab", { detail: "idv" }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-left group"
    >
      <div
        className="rounded-xl p-6 flex items-center justify-between transition-all duration-200 group-hover:shadow-lg"
        style={{
          background:
            "linear-gradient(135deg, #e9eaff 0%, #d3d5ff 50%, #bec0fe 100%)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-ube-600 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-ube-1000">
              Fraud is one side of the story. What happens when identity
              verification itself fails?
            </p>
            <p className="text-sm text-ube-1000/70 mt-1">
              Explore the Identity Verification tab to see where
              verification breaks down
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-ube-600 transition-transform duration-200 group-hover:translate-x-1 flex-shrink-0" />
      </div>
    </button>
  );
}
