"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Database,
  Filter,
  GitBranch,
  MessageSquare,
  Layers,
  BarChart3,
  Telescope,
} from "lucide-react";
import { CollectionStrategyModal } from "./collection-strategy-modal";

interface PipelineModalProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    icon: Database,
    title: "Data Collection",
    description:
      "Public Reddit posts collected across fraud, identity verification, and security-focused communities.",
    model: "Reddit JSON API",
    metrics: ["49,499 posts", "7,393 subreddits"],
    color: "#878cfe",
  },
  {
    icon: Filter,
    title: "Pre-filtering",
    description:
      "Filtered out posts with removed or empty content, posts with more downvotes than upvotes, and posts with insufficient text (no body and titles under 30 characters) to ensure classification quality.",
    model: null,
    metrics: ["40,316 posts retained"],
    color: "#878cfe",
  },
  {
    icon: GitBranch,
    title: "Pass 1: Boolean Routing",
    description:
      "LLM binary classification determines whether each post discusses fraud, identity verification, or both.",
    model: "OpenAI GPT-OSS-120B",
    metrics: ["12,556 fraud-flagged", "14,595 IDV-flagged", "2,154 both"],
    color: "#010668",
  },
  {
    icon: MessageSquare,
    title: "Comment Enrichment",
    description:
      "Top 5 community responses collected per relevant post to capture discussion context beyond the original post.",
    model: "Reddit JSON API",
    metrics: ["Top 5 per post"],
    color: "#878cfe",
  },
  {
    icon: Layers,
    title: "Pass 2: Deep Classification",
    description:
      "LLM-powered structured classification of each post and its comment thread across 12 dimensions with Pydantic-validated output schemas.",
    model: "DeepSeek v3.2",
    metrics: ["8,739 fraud relevant", "11,737 IDV relevant"],
    color: "#010668",
  },
  {
    icon: BarChart3,
    title: "Dashboard",
    description:
      "Interactive exploration with drill-downs, cross-dimensional filtering, and individual post analysis.",
    model: null,
    metrics: ["12 classification dimensions"],
    color: "#878cfe",
  },
];

export function PipelineModal({ open, onClose }: PipelineModalProps) {
  const [strategyOpen, setStrategyOpen] = useState(false);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (strategyOpen) {
          setStrategyOpen(false);
        } else {
          onClose();
        }
      }
    },
    [onClose, strategyOpen]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
      };
    }
  }, [open, handleEscape]);

  // Reset strategy modal when pipeline modal closes
  useEffect(() => {
    if (!open) setStrategyOpen(false);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !strategyOpen) onClose();
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[820px] max-h-[85vh] overflow-y-auto modal-enter">
          {/* Header */}
          <div className="sticky top-0 bg-white rounded-t-2xl border-b border-fog-200 px-6 py-5 flex items-start justify-between z-10">
            <div>
              <h2 className="text-lg font-bold text-fog-900">Data Pipeline</h2>
              <p className="text-sm text-fog-500 mt-0.5">
                From Reddit posts to structured intelligence
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-fog-400 hover:text-fog-700 hover:bg-fog-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Collection Strategy Link */}
          <div className="px-6 pt-5 pb-1">
            <button
              onClick={() => setStrategyOpen(true)}
              className="flex items-center gap-2 text-sm font-semibold text-ube-1000 bg-ube-100 hover:bg-ube-150 transition-colors border border-ube-200 rounded-lg px-4 py-2.5 w-full text-left"
            >
              <Telescope className="w-4 h-4 flex-shrink-0" />
              View data collection strategy
            </button>
          </div>

          {/* Pipeline Flowchart */}
          <div className="px-6 py-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isLast = i === steps.length - 1;

              return (
                <div key={step.title} className="flex gap-4">
                  {/* Left: circle + connector line */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 bg-white"
                      style={{ borderColor: step.color }}
                    >
                      <Icon
                        className="w-4 h-4"
                        style={{ color: step.color }}
                      />
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 min-h-6 bg-ube-200" />
                    )}
                  </div>

                  {/* Right: content */}
                  <div className={`pt-1 ${isLast ? "" : "pb-6"}`}>
                    <h3 className="text-base font-semibold text-fog-800">
                      {step.title}
                    </h3>
                    <p className="text-sm text-fog-500 leading-relaxed mt-1">
                      {step.description}
                    </p>
                    {(step.model || step.metrics.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {step.model && (
                          <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-fog-200 text-fog-700">
                            {step.model}
                          </span>
                        )}
                        {step.metrics.map((metric) => (
                          <span
                            key={metric}
                            className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-ube-100 text-ube-1000"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Classification Accuracy */}
          <div className="px-6 pb-6">
            <div className="bg-fog-100 rounded-lg px-4 py-4">
              <p className="text-sm font-semibold text-fog-600 mb-1">
                Classification Accuracy
              </p>
              <p className="text-sm text-fog-500 leading-relaxed mb-4">
                Each classification pass was validated against independent
                1,000-post random samples evaluated by Claude Opus 4.6 as an
                independent judge.
              </p>

              {/* Pass 1 */}
              <p className="text-xs font-semibold text-fog-500 uppercase tracking-wider mb-2">
                Pass 1: Boolean Routing
              </p>
              <div className="border border-fog-300 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-fog-500 border-b border-fog-300">
                      <th className="px-2.5 py-1.5 font-medium">Flag</th>
                      <th className="px-2.5 py-1.5 font-medium text-right">Precision</th>
                      <th className="px-2.5 py-1.5 font-medium text-right">Recall</th>
                      <th className="px-2.5 py-1.5 font-medium text-right">F1</th>
                    </tr>
                  </thead>
                  <tbody className="text-fog-700">
                    <tr className="border-b border-fog-300">
                      <td className="px-2.5 py-1.5">is_fraud</td>
                      <td className="px-2.5 py-1.5 text-right">81.3%</td>
                      <td className="px-2.5 py-1.5 text-right">97.1%</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold">88.5%</td>
                    </tr>
                    <tr>
                      <td className="px-2.5 py-1.5">is_idv</td>
                      <td className="px-2.5 py-1.5 text-right">79.6%</td>
                      <td className="px-2.5 py-1.5 text-right">97.1%</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold">87.5%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Pass 2 */}
              <p className="text-xs font-semibold text-fog-500 uppercase tracking-wider mb-2">
                Pass 2: Relevance Filtering
              </p>
              <div className="border border-fog-300 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-fog-500 border-b border-fog-300">
                      <th className="px-2.5 py-1.5 font-medium">Track</th>
                      <th className="px-2.5 py-1.5 font-medium text-right">Precision</th>
                      <th className="px-2.5 py-1.5 font-medium text-right">Recall</th>
                      <th className="px-2.5 py-1.5 font-medium text-right">F1</th>
                    </tr>
                  </thead>
                  <tbody className="text-fog-700">
                    <tr className="border-b border-fog-300">
                      <td className="px-2.5 py-1.5">Fraud</td>
                      <td className="px-2.5 py-1.5 text-right">93.6%</td>
                      <td className="px-2.5 py-1.5 text-right">83.8%</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold">88.4%</td>
                    </tr>
                    <tr>
                      <td className="px-2.5 py-1.5">IDV</td>
                      <td className="px-2.5 py-1.5 text-right">91.8%</td>
                      <td className="px-2.5 py-1.5 text-right">92.5%</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold">92.1%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Limitations */}
          <div className="px-6 pb-6">
            <div className="bg-fog-100 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-fog-600 mb-1">
                Limitations
              </p>
              <p className="text-sm text-fog-500 leading-relaxed">
                Reddit data skews toward English-speaking, tech-savvy users.
                Complaint-driven discussions overrepresent negative experiences.
                Loss amounts are self-reported. Platform mentions reflect Reddit
                user demographics, not market share.
              </p>
            </div>
          </div>
        </div>
      </div>

      <CollectionStrategyModal
        open={strategyOpen}
        onClose={() => setStrategyOpen(false)}
      />
    </>
  );
}
