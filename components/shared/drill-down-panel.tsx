"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  DrillDownConfig,
  DrillDownResponse,
} from "@/lib/types/drill-down";
import { DrillDownHeader } from "./drill-down-header";
import { DrillDownExplainer } from "./drill-down-explainer";
import { DrillDownInsight } from "./drill-down-insight";
import { DrillDownCharts } from "./drill-down-charts";
import { DrillDownPosts } from "./drill-down-posts";

interface DrillDownPanelProps {
  config: DrillDownConfig | null;
  onClose: () => void;
}

export function DrillDownPanel({ config, onClose }: DrillDownPanelProps) {
  const [data, setData] = useState<DrillDownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondaryFilter, setSecondaryFilter] = useState<{
    dimension: string;
    value: string;
  } | null>(null);

  // Build the current filter params
  const buildParams = useCallback(() => {
    if (!config) return null;
    const params: Record<string, string> = {
      type: config.type,
      [config.dimension]: config.value,
    };
    if (secondaryFilter) {
      params[secondaryFilter.dimension] = secondaryFilter.value;
    }
    return params;
  }, [config, secondaryFilter]);

  // Fetch data when config or secondary filter changes
  useEffect(() => {
    const params = buildParams();
    if (!params) {
      setData(null);
      return;
    }

    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams(params!);
        const res = await fetch(`/api/drill-down?${qs}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          console.error("Drill-down fetch error:", err);
          setError(String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [buildParams]);

  // Reset secondary filter when primary config changes (or seed from config)
  useEffect(() => {
    if (config?.secondaryDimension && config?.secondaryValue) {
      setSecondaryFilter({
        dimension: config.secondaryDimension,
        value: config.secondaryValue,
      });
    } else {
      setSecondaryFilter(null);
    }
  }, [config?.dimension, config?.value, config?.type, config?.secondaryDimension, config?.secondaryValue]);

  // Close on Escape key
  useEffect(() => {
    if (!config) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [config, onClose]);

  // Lock body scroll when panel is open
  useEffect(() => {
    if (config) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [config]);

  if (!config) return null;

  const filters = buildParams() || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-[67vw] max-w-[960px] min-w-[640px] h-screen bg-white rounded-l-2xl shadow-2xl overflow-y-auto panel-enter">
        {/* Header */}
        <DrillDownHeader
          type={config.type}
          dimension={config.dimension}
          value={config.value}
          total={data?.total ?? 0}
          tabTotal={data?.tabTotal ?? 0}
          percent={data?.percent ?? 0}
          sentimentPercent={data?.sentimentPercent}
          secondaryFilter={secondaryFilter}
          onRemoveSecondary={() => setSecondaryFilter(null)}
          onClose={onClose}
        />

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-ube-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48 text-sm text-red-600">
              <p>Error loading data: {error}</p>
            </div>
          ) : data ? (
            <>
              {/* Contextual explainer */}
              <DrillDownExplainer
                type={config.type}
                dimension={config.dimension}
                value={config.value}
              />

              {/* Auto-insight */}
              <DrillDownInsight
                breakdowns={data.breakdowns}
                total={data.total}
                type={config.type}
              />

              {/* Mini-charts */}
              <DrillDownCharts
                type={config.type}
                breakdowns={data.breakdowns}
                onFilterClick={(dimension, value) => {
                  if (secondaryFilter) return; // max 2 chips
                  setSecondaryFilter({ dimension, value });
                }}
                canAddFilter={!secondaryFilter}
              />

              {/* Post list */}
              <DrillDownPosts
                posts={data.posts}
                totalCount={data.postsTotalCount}
                filters={filters}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
