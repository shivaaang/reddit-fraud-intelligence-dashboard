import { SectionHeader } from "@/components/shared/section-header";
import { SectionTransition } from "@/components/shared/section-transition";
import { TakeawayCard } from "@/components/shared/takeaway-card";
import { RecommendationsSection } from "@/components/shared/recommendations-section";
import { CrossTabTeaserFraud } from "@/components/shared/cross-tab-teaser-fraud";
import { HeroZone } from "@/components/shared/hero-zone";
import { IdvKPIStrip } from "@/components/idv/idv-kpi-strip";
import { FrictionTypeChart } from "@/components/idv/friction-type-chart";
import { VerificationBars } from "@/components/idv/verification-bars";
import { TriggerReasonChart } from "@/components/idv/trigger-reason-chart";
import { PlatformFrictionChart } from "@/components/idv/platform-friction-chart";
import { IdvTags } from "@/components/idv/idv-tags";
import { IdvInsightCards } from "@/components/idv/idv-insight-cards";
import { LivenessCallout } from "@/components/idv/liveness-callout";

import {
  getIdvKPIs,
  getIdvHeroStats,
  getFrictionTypeDistribution,
  getVerificationTypeDistribution,
  getTriggerReasonDistribution,
  getPlatformFriction,
  getIdvTags,
  getIdvInsightData,
} from "@/lib/queries/idv";

export async function IdvTab() {
  const [
    idvKpis,
    heroStats,
    frictionTypes,
    verificationTypes,
    triggerReasons,
    platformFriction,
    tags,
    insightData,
  ] = await Promise.all([
    getIdvKPIs(),
    getIdvHeroStats(),
    getFrictionTypeDistribution(),
    getVerificationTypeDistribution(),
    getTriggerReasonDistribution(),
    getPlatformFriction(),
    getIdvTags(),
    getIdvInsightData(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Zone */}
      <HeroZone
        type="idv"
        totalPosts={idvKpis.totalPosts}
        topSubreddits={heroStats.topSubreddits}
      />

      {/* KPI Strip */}
      <IdvKPIStrip kpis={idvKpis} />

      <SectionTransition text="What goes wrong during verification, and which methods cause the most friction?" />

      {/* Charts Row: Friction Types + Verification Methods */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <SectionHeader
            title="Friction Type Breakdown"
            subtitle="What goes wrong during identity verification"
            annotation="False rejection is the leading friction type by a significant margin. This is the core tension in modern IDV: every incorrectly rejected user is a potential customer lost."
          />
          <FrictionTypeChart data={frictionTypes} />
        </div>
        <div>
          <SectionHeader
            title="Verification Methods"
            subtitle="Distribution of verification types encountered"
            annotation="Biometric methods (selfie, liveness, facial age estimation) appear in a significant share of friction discussions despite being one part of the verification stack. The technical complexity of face-matching creates disproportionate failure points."
          />
          <VerificationBars data={verificationTypes} />
        </div>
      </section>

      <SectionTransition text="Why are users being asked to verify in the first place?" />

      {/* Trigger Reason Distribution */}
      <section>
        <SectionHeader
          title="Verification Triggers"
          subtitle="Why users encounter identity verification"
          annotation="Understanding what triggers verification reveals whether friction comes from onboarding (fixable with better UX), suspicious activity flags, or periodic rechecks (a policy problem)."
        />
        <TriggerReasonChart data={triggerReasons} />
      </section>

      <SectionTransition text="Which platforms are generating the most friction?" />

      {/* Platform Friction */}
      <section>
        <SectionHeader
          title="Platform Friction Leaderboard"
          subtitle="Top 10 platforms by IDV discussion volume, with their primary friction type"
          annotation="Each platform's dominant friction type reveals a distinct failure mode. Notice how gig platforms cluster around reverification, while financial platforms concentrate on new-account onboarding friction."
        />
        <PlatformFrictionChart data={platformFriction} />
      </section>

      <SectionTransition text="Beneath the categories, recurring themes emerge across thousands of posts" />

      {/* IDV Tags */}
      <section>
        <SectionHeader
          title="Verification Signal Tags"
          subtitle="Recurring themes and patterns extracted from IDV discussions"
        />
        <IdvTags data={tags} />
      </section>

      <SectionTransition text="Three patterns that define where IDV friction concentrates" />

      {/* Insight Story Cards */}
      <section>
        <SectionHeader
          title="Friction Frontiers"
          subtitle="Three patterns shaping the IDV landscape"
        />
        <IdvInsightCards data={insightData} />
      </section>

      {/* Biometric Verification Callout */}
      <section>
        <LivenessCallout
          livenessCount={insightData.livenessCount}
          biometricBreakdown={insightData.biometricBreakdown}
        />
      </section>

      {/* Cross-Tab Bridge → Fraud */}
      <CrossTabTeaserFraud />

      {/* Key Findings */}
      <TakeawayCard
        title="Key Findings"
        points={[
          "False rejection dominates across every dimension: friction type, platform, and sentiment. It's not a niche technical issue; it's the defining failure mode of modern identity verification, and every occurrence risks permanently losing a real customer.",
          `${Math.round(idvKpis.negativeSentimentPercent)}% of IDV discussions carry negative sentiment, but the nature of that negativity varies by context. New account verification generates resignation; reverification triggers frustration; false rejection produces outrage. The emotional intensity of friction matters as much as its frequency.`,
          "Age verification and gig worker reverification are two major friction frontiers where compliance requirements and user tolerance are on a direct collision course, and where privacy resistance is beginning to compound the challenge.",
        ]}
      />

      {/* Strategic Implications */}
      <RecommendationsSection
        title="Strategic Implications"
        cards={[
          {
            headline: "Reduce False Rejections",
            dataPoint:
              "Users describe being told they're not who they say they are, rejected despite submitting valid documents. The emotional and practical cost compounds with every false negative.",
            recommendation:
              "Improving document parsing, supporting name variants and non-Latin scripts, and better face-matching across appearance changes would recapture users currently being turned away.",
            accentColor: "#e5484d",
          },
          {
            headline: "Adaptive Verification for Gig Platforms",
            dataPoint:
              "Gig platforms are among the most-discussed for verification friction, and unlike other platforms, failed checks have immediate economic consequences for workers who can't earn during downtime.",
            recommendation:
              "Adaptive risk scoring could reduce unnecessary re-checks while maintaining security, reserving full reverification for genuinely suspicious activity.",
            accentColor: "#878cfe",
          },
          {
            headline: "Fallback Verification Paths",
            dataPoint:
              "When automated verification fails, users describe hitting a dead end: no fallback method, no escalation path, no manual review option. A single point of failure in the verification flow.",
            recommendation:
              "Offering fallback verification paths (manual review, alternative document types, video-assisted verification) prevents permanent lockout and recovers users that automated systems reject.",
            accentColor: "#010668",
          },
          {
            headline: "Age Verification at Scale",
            dataPoint:
              "Regulatory mandates are driving age verification adoption beyond gaming and social media into new verticals, faster than purpose-built solutions can keep up.",
            recommendation:
              "Facial age estimation that minimizes false rejection for real users, especially younger demographics without traditional ID, is a significant product opportunity as age gates expand across industries.",
            accentColor: "#bec0fe",
          },
        ]}
      />
    </div>
  );
}
