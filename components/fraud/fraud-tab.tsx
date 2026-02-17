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
import { FraudInsightCards } from "./fraud-insight-cards";
import { FraudCallout } from "./fraud-callout";
import { toTitleCase } from "@/lib/utils";

import {
  getFraudKPIs,
  getFraudHeroStats,
  getFraudTypeDistribution,
  getIndustryBreakdown,
  getFraudIndustryMatrix,
  getChannelDistribution,
  getLossBracketDistribution,
  getFraudTags,
  getFraudInsightData,
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
    insightData,
  ] = await Promise.all([
    getFraudKPIs(),
    getFraudHeroStats(),
    getFraudTypeDistribution(),
    getIndustryBreakdown(),
    getFraudIndustryMatrix(),
    getChannelDistribution(),
    getLossBracketDistribution(),
    getFraudTags(),
    getFraudInsightData(),
  ]);

  const identityTheftPercent =
    kpis.totalPosts > 0
      ? Math.round((kpis.topFraudTypeCount / kpis.totalPosts) * 100)
      : 0;

  const midRangeLoss = lossBrackets.find((b) => b.name === "1k_to_10k");
  const midRangeLossCount = midRangeLoss?.count ?? 0;

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

      <SectionTransition text="What types of fraud dominate the landscape, and by how much?" />

      {/* Fraud Type Distribution */}
      <section>
        <SectionHeader
          title="Fraud Type Distribution"
          subtitle="How different fraud types compare in volume"
          annotation="Identity theft leads by volume, but the deeper pattern is how fraud types interconnect. Account takeover and synthetic identity both rely on stolen identity as their core mechanism. Click any bar to drill down into the underlying posts."
        />
        <FraudTypeChart data={fraudTypes} />
      </section>

      <SectionTransition text="These fraud types don't hit all industries equally" />

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
          annotation="The darkest cells show where fraud types concentrate by industry. Each industry attracts the fraud types suited to its transaction patterns and verification gaps."
        />
        <FraudIndustryMatrix data={matrix} />
      </section>

      <SectionTransition text="How does fraud reach victims, and what is the financial damage?" />

      {/* Channel & Loss Bracket */}
      <section>
        <SectionHeader
          title="Attack Channels & Financial Impact"
          subtitle="How fraud reaches victims and the financial damage discussed"
          annotation="Social media leads as both an attack surface and a coordination channel for fraud operations. Among posts mentioning specific amounts, losses concentrate in the $1K-$10K range: above casual inconvenience, below institutional investigation thresholds."
        />
        <ChannelImpactCharts
          channelData={channels}
          lossData={lossBrackets}
        />
      </section>

      <SectionTransition text="Beneath the categories, recurring signals emerge across thousands of posts" />

      {/* Tags */}
      <section>
        <SectionHeader
          title="Fraud Signal Tags"
          subtitle="Recurring themes and patterns extracted from fraud discussions"
        />
        <FraudTags data={tags} />
      </section>

      <SectionTransition text="Three patterns that define the fraud landscape beyond the numbers" />

      {/* Fraud Deep Dives */}
      <section>
        <SectionHeader
          title="Fraud Deep Dives"
          subtitle="Three patterns shaping the fraud landscape"
        />
        <FraudInsightCards data={insightData} />
      </section>

      {/* Financial Impact Callout */}
      <section>
        <FraudCallout
          midRangeLossCount={midRangeLossCount}
          lossBrackets={lossBrackets}
        />
      </section>

      {/* Cross-Tab Bridge → IDV */}
      <CrossTabTeaser />

      {/* Key Findings */}
      <TakeawayCard
        title="Key Findings"
        points={[
          `${toTitleCase(kpis.topFraudType)} accounts for ${identityTheftPercent}% of classified fraud discussions, but the real pattern is how fraud types interconnect. Account takeover, synthetic identity, and social engineering all exploit the same core vulnerability: the gap between who someone claims to be and who they actually are. Identity is not just the leading fraud type; it is the mechanism underlying the majority of the fraud landscape.`,
          "Financial losses concentrate in the $1K-$10K range among posts that discuss specific amounts, high enough to cause genuine hardship for individual victims but frequently below institutional investigation thresholds. This creates a systemic response gap where victims face significant damage while their cases fall between automated fraud detection and dedicated investigation teams.",
          "Social media serves as both the primary attack channel and a coordination hub where fraud tactics are shared and refined. This dual role gives platform-level intervention disproportionate leverage: identity verification at account creation and high-risk interaction points could disrupt both the execution and the coordination of fraud at the same chokepoint.",
        ]}
      />

      {/* Strategic Implications */}
      <RecommendationsSection
        title="Strategic Implications"
        cards={[
          {
            headline: "Close the Identity Fraud Loop",
            dataPoint:
              "Identity theft and account takeover together dominate the fraud landscape, both exploiting the same vulnerability: the gap between claimed and actual identity.",
            recommendation:
              "Verification at account creation catches the front door, but the data shows fraud also exploits recovery flows, ownership transfers, and high-value transactions. Each of these moments requires identity re-confirmation calibrated to the specific risk level of the action.",
            accentColor: "#010668",
          },
          {
            headline: "Bridge the Investigation Gap",
            dataPoint:
              "Losses in the $1K-$10K range dominate fraud discussions. Victims describe being told their case doesn't meet the threshold for investigation while facing genuinely damaging financial consequences.",
            recommendation:
              "Automated identity verification at dispute and recovery touchpoints could help institutions respond to mid-range fraud more efficiently, reducing the manual investigation burden while ensuring victims are not abandoned below arbitrary thresholds.",
            accentColor: "#878cfe",
          },
          {
            headline: "Intercept Social Engineering at Trust Points",
            dataPoint:
              "Social engineering attacks (phishing, romance scams, impersonation) bypass technical controls by exploiting human trust. The victim's own behavior appears legitimate, making these attacks invisible to traditional fraud detection.",
            recommendation:
              "Identity verification at critical trust-establishment moments (first financial transaction with a new contact, unusual transfer patterns) introduces friction precisely where social engineering attacks rely on seamless, unquestioned flow.",
            accentColor: "#bec0fe",
          },
          {
            headline: "Defend Against AI-Enhanced Fraud",
            dataPoint:
              "Deepfakes, AI-generated voices, and synthetic identities represent a distinct layer of fraud sophistication. AI-generated content is increasingly difficult to distinguish from legitimate identity artifacts using traditional methods.",
            recommendation:
              "Liveness detection, advanced document forensics, and injection attack detection form the primary defense against AI-manipulated identity. As synthetic media quality improves, the gap between human judgment and automated verification widens, making machine-level detection essential.",
            accentColor: "#e5484d",
          },
        ]}
      />
    </div>
  );
}
