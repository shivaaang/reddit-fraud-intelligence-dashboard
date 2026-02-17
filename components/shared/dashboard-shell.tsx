"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Shield, Fingerprint, Github, DatabaseZap } from "lucide-react";
import { PipelineModal } from "./pipeline-modal";

interface DashboardShellProps {
  fraudTab: ReactNode;
  idvTab: ReactNode;
}

export function DashboardShell({ fraudTab, idvTab }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<"fraud" | "idv">("idv");
  const [pipelineOpen, setPipelineOpen] = useState(false);

  useEffect(() => {
    function handleTabSwitch(e: Event) {
      const tab = (e as CustomEvent).detail;
      if (tab === "fraud" || tab === "idv") setActiveTab(tab);
    }
    window.addEventListener("switch-tab", handleTabSwitch);
    return () => window.removeEventListener("switch-tab", handleTabSwitch);
  }, []);

  return (
    <div className="min-h-screen bg-fog-100">
      {/* Header */}
      <header
        className="text-white"
        style={{
          background: "linear-gradient(135deg, #7074e8 0%, #878cfe 60%, #9ba0ff 100%)",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-8 pt-10 pb-6 flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm font-medium uppercase tracking-widest mb-2">
              Intelligence Dashboard
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Reddit Identity Verification & Fraud Landscape
            </h1>
            <p className="text-white/75 mt-2 text-base">
              What 40,000+ public Reddit posts reveal about identity
              verification and fraud · January 2025 onwards
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-1 w-[180px]">
            <button
              onClick={() => setPipelineOpen(true)}
              className="flex items-center justify-center gap-2.5 w-full px-5 py-2.5 rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <DatabaseZap className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold whitespace-nowrap">
                View Pipeline
              </span>
            </button>
            <a
              href="https://github.com/shivaaang/reddit-fraud-intelligence-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full px-5 py-2.5 rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Github className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold whitespace-nowrap">
                GitHub
              </span>
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-[1440px] mx-auto px-8">
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab("idv")}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-lg text-sm font-semibold transition-colors ${
                activeTab === "idv"
                  ? "bg-white text-ube-1000 shadow-sm"
                  : "text-white/80 border border-white/20 hover:text-white hover:bg-white/10"
              }`}
            >
              <Fingerprint className="w-4 h-4" />
              Identity Verification
            </button>
            <button
              onClick={() => setActiveTab("fraud")}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-lg text-sm font-semibold transition-colors ${
                activeTab === "fraud"
                  ? "bg-white text-ube-1000 shadow-sm"
                  : "text-white/80 border border-white/20 hover:text-white hover:bg-white/10"
              }`}
            >
              <Shield className="w-4 h-4" />
              Fraud Landscape
            </button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1440px] mx-auto px-8 pt-6 pb-10">
        {activeTab === "idv" ? idvTab : fraudTab}
      </main>

      {/* Footer */}
      <footer className="border-t border-fog-200 py-8 mt-16 bg-fog-100">
        <div className="max-w-[1440px] mx-auto px-8 text-center">
          <p className="text-sm text-fog-500">
            Built on 40,316 public Reddit posts collected from January 2025
            onwards, classified for fraud and identity verification relevance
          </p>
          <p className="text-xs text-fog-500 mt-2">
            Two-pass classification pipeline · Structured across type,
            industry, channel, platform, and sentiment
          </p>
        </div>
      </footer>

      <PipelineModal
        open={pipelineOpen}
        onClose={() => setPipelineOpen(false)}
      />
    </div>
  );
}
