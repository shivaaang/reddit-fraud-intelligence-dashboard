import { SectionHeader } from "@/components/shared/section-header";
import { SectionTransition } from "@/components/shared/section-transition";
import { TakeawayCard } from "@/components/shared/takeaway-card";
import { RecommendationsSection } from "@/components/shared/recommendations-section";
import { CrossTabTeaser } from "@/components/shared/cross-tab-teaser";
import { HeroZone } from "@/components/shared/hero-zone";
import { FraudKPIStrip } from "./fraud-kpi-strip";
import { FraudTypeChart } from "./fraud-type-chart";
import { IndustryChart } from "./industry-chart";
import { FraudIndustryMatrix } from "./fraud-industry-matrix";
import { ChannelImpactCharts } from "./channel-impact-charts";
import { FraudTags } from "./fraud-tags";
import { FraudVoices } from "./fraud-voices";

import {
  getFraudKPIs,
  getFraudHeroStats,
  getFraudTypeDistribution,
  getIndustryBreakdown,
  getFraudIndustryMatrix,
  getChannelDistribution,
  getLossBracketDistribution,
  getFraudTags,
  getFraudQuotes,
  getAiThreatCount,
} from "@/lib/queries/fraud";

export async function FraudTab() {
  const [
    kpis,
    heroStats,
    fraudTypes,
    industries,
    matrix,
    channels,
    lossBrackets,
    tags,
    quotes,
    aiThreatCount,
  ] = await Promise.all([
    getFraudKPIs(),
    getFraudHeroStats(),
    getFraudTypeDistribution(),
    getIndustryBreakdown(),
    getFraudIndustryMatrix(),
    getChannelDistribution(),
    getLossBracketDistribution(),
    getFraudTags(),
    getFraudQuotes(),
    getAiThreatCount(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Zone */}
      <HeroZone
        type="fraud"
        totalPosts={kpis.totalPosts}
        topSubreddits={heroStats.topSubreddits}
      />

      {/* KPI Strip */}
      <FraudKPIStrip kpis={kpis} />

      <SectionTransition text="Let's break down what those 8,000+ posts look like by type →" />

      {/* Fraud Type Distribution */}
      <section>
        <SectionHeader
          title="Fraud Type Distribution"
          subtitle="How different fraud types compare in volume"
          annotation="Identity theft leads by a wide margin, followed by payment fraud and account takeover. Click any bar to drill down into the underlying posts."
        />
        <FraudTypeChart data={fraudTypes} />
      </section>

      <SectionTransition text="These fraud types don't hit all industries equally →" />

      {/* Industry Breakdown */}
      <section>
        <SectionHeader
          title="Most Targeted Industries"
          subtitle="Top 8 industries by fraud post volume"
        />
        <IndustryChart data={industries} />
      </section>

      <SectionTransition text="Where do specific fraud types concentrate within each industry?" />

      {/* Fraud x Industry Matrix */}
      <section>
        <SectionHeader
          title="Fraud Type × Industry Matrix"
          subtitle="Where fraud types concentrate across industries"
          annotation="The darkest cells reveal where specific fraud types concentrate. Identity theft in banking is the highest-volume combination in the dataset."
        />
        <FraudIndustryMatrix data={matrix} />
      </section>

      <SectionTransition text="Now: how does fraud reach victims, and what's the financial damage?" />

      {/* Channel & Loss Bracket */}
      <section>
        <SectionHeader
          title="Attack Channels & Financial Impact"
          subtitle="How fraud reaches victims and the financial damage discussed"
          annotation="Social media is the #1 attack surface, and losses are heavily concentrated in the $1K–$10K range. High enough to devastate individuals, but often below the threshold for institutional response."
        />
        <ChannelImpactCharts
          channelData={channels}
          lossData={lossBrackets}
        />
      </section>

      <SectionTransition text="Beneath the categories, recurring signals emerge across thousands of posts →" />

      {/* Tags */}
      <section>
        <SectionHeader
          title="Fraud Signal Tags"
          subtitle="Recurring themes and patterns extracted from fraud discussions"
        />
        <FraudTags data={tags} />
      </section>

      <SectionTransition text="Behind every data point is a real person. Here's what they're saying." />

      {/* Voices from Reddit */}
      <section>
        <SectionHeader
          title="From the Front Lines"
          subtitle="Real quotes from fraud victims and community discussions"
        />
        <FraudVoices quotes={quotes} aiThreatCount={aiThreatCount} />
      </section>

      {/* Cross-Tab Bridge → IDV */}
      <CrossTabTeaser />

      {/* Executive Takeaway */}
      <TakeawayCard
        title="What the data tells us"
        points={[
          "Identity theft is the most reported fraud type, followed by payment fraud and account takeover. Identity is the core attack vector across the fraud landscape.",
          "Banking and financial services are the most targeted industries, with social media as the primary attack channel.",
          "AI-powered fraud (deepfakes, voice cloning, synthetic identities) is an emerging and growing threat, signaling a shift in fraud sophistication.",
        ]}
      />

      {/* Strategic Implications */}
      <RecommendationsSection
        title="Strategic Implications"
        cards={[
          {
            headline: "Identity Is the Core Attack Vector",
            dataPoint:
              "Identity theft and account takeover are the two highest-volume fraud types. Both use stolen or fabricated identity as the primary mechanism.",
            recommendation:
              "Understanding how identity is exploited across the fraud lifecycle is critical for designing verification that targets the right moments.",
            accentColor: "#010668",
          },
          {
            headline: "Banking & Fintech Are Ground Zero",
            dataPoint:
              "Banking and financial services lead fraud discussions, aligning with sectors that already mandate KYC/AML compliance.",
            recommendation:
              "The industries with the most fraud are also the industries with the strongest regulatory mandate for identity verification, a natural alignment for IDV providers.",
            accentColor: "#878cfe",
          },
          {
            headline: "Social Media as Attack Vector",
            dataPoint:
              "Social media is the #1 attack channel, with platforms used both for executing scams and for impersonation-based fraud.",
            recommendation:
              "Platforms deploying identity verification at account creation and for high-risk actions could intercept fraud at the primary attack surface.",
            accentColor: "#bec0fe",
          },
          {
            headline: "AI-Powered Fraud Demands Next-Gen IDV",
            dataPoint:
              "Deepfakes, AI-generated voices, and synthetic identities are accelerating fraud sophistication across all categories.",
            recommendation:
              "Liveness detection and advanced document forensics are the primary defense against AI-manipulated identity attacks. The need for these capabilities is growing rapidly.",
            accentColor: "#e5484d",
          },
        ]}
      />
    </div>
  );
}
