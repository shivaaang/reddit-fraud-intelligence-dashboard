"use client";

import { ArrowRight, Shield } from "lucide-react";

export function CrossTabTeaserFraud() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("switch-tab", { detail: "fraud" }));
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
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-ube-1000">
              Verification friction doesn&apos;t exist in a vacuum. What fraud patterns are driving the demand?
            </p>
            <p className="text-sm text-ube-1000/70 mt-1">
              Explore the Fraud Landscape tab to see where identity is being exploited
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-ube-600 transition-transform duration-200 group-hover:translate-x-1 flex-shrink-0" />
      </div>
    </button>
  );
}
