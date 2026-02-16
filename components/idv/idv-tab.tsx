import { SectionHeader } from "@/components/shared/section-header";
import { SectionTransition } from "@/components/shared/section-transition";
import { TakeawayCard } from "@/components/shared/takeaway-card";
import { RecommendationsSection } from "@/components/shared/recommendations-section";
import { HeroZone } from "@/components/shared/hero-zone";
import { IdvKPIStrip } from "@/components/idv/idv-kpi-strip";
import { FrictionTypeChart } from "@/components/idv/friction-type-chart";
import { VerificationBars } from "@/components/idv/verification-bars";
import { TriggerReasonChart } from "@/components/idv/trigger-reason-chart";
import { PlatformFrictionChart } from "@/components/idv/platform-friction-chart";
import { IdvInsightCards } from "@/components/idv/idv-insight-cards";
import { IdvVoices } from "@/components/idv/idv-voices";
import { LivenessCallout } from "@/components/idv/liveness-callout";

import {
  getIdvKPIs,
  getIdvHeroStats,
  getFrictionTypeDistribution,
  getVerificationTypeDistribution,
  getTriggerReasonDistribution,
  getPlatformFriction,
  getIdvQuotes,
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
    quotes,
    insightData,
  ] = await Promise.all([
    getIdvKPIs(),
    getIdvHeroStats(),
    getFrictionTypeDistribution(),
    getVerificationTypeDistribution(),
    getTriggerReasonDistribution(),
    getPlatformFriction(),
    getIdvQuotes(),
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

      <SectionTransition text="What exactly goes wrong during verification, and which methods cause the most friction?" />

      {/* Charts Row: Friction Types + Verification Methods */}
      <section className="grid grid-cols-2 gap-6">
        <div>
          <SectionHeader
            title="Friction Type Breakdown"
            subtitle="What goes wrong during identity verification"
            annotation="False rejection dwarfs every other friction type. This is the core tension: every rejected legitimate user is a potential customer lost."
          />
          <FrictionTypeChart data={frictionTypes} />
        </div>
        <div>
          <SectionHeader
            title="Verification Methods"
            subtitle="Distribution of verification types encountered"
            annotation="Biometric methods (selfie, liveness, facial age estimation) are color-coded separately. These represent the most technically demanding verification steps."
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
          annotation="Each platform's top friction type reveals its specific IDV failure mode. False rejection dominates: legitimate users locked out of their own accounts."
        />
        <PlatformFrictionChart data={platformFriction} />
      </section>

      <SectionTransition text="Three emerging patterns that signal where IDV is heading →" />

      {/* Insight Story Cards */}
      <section>
        <SectionHeader
          title="Emerging Patterns"
          subtitle="Three signals shaping the IDV landscape"
        />
        <IdvInsightCards data={insightData} />
      </section>

      <SectionTransition text="The data tells one story. The users tell another." />

      {/* User Voices */}
      <section>
        <SectionHeader
          title="From the Front Lines"
          subtitle="What real users say when verification fails them"
        />
        <IdvVoices quotes={quotes} />
      </section>

      {/* Liveness Callout */}
      <section>
        <LivenessCallout
          livenessCount={insightData.livenessCount}
          biometricBreakdown={insightData.biometricBreakdown}
        />
      </section>

      {/* Executive Takeaway */}
      <TakeawayCard
        title="What the data tells us"
        points={[
          "False rejection is the #1 problem. Legitimate users are being locked out at scale, and every false rejection risks losing a real customer.",
          "The vast majority of IDV discussions carry negative sentiment, signaling a massive UX gap between what verification systems demand and what users will tolerate.",
          "Age verification and gig worker identity checks represent two fast-growing friction frontiers where the balance between compliance and user experience is most acute.",
        ]}
      />

      {/* Opportunities for IDV Providers */}
      <RecommendationsSection
        title="Opportunities for IDV Providers"
        cards={[
          {
            headline: "Reduce False Rejections",
            dataPoint:
              "False rejection is the dominant friction type. Legitimate users are being told they're not who they say they are.",
            recommendation:
              "Improving document parsing, supporting name variants and non-Latin scripts, and better face-matching across appearance changes would recapture legitimate users currently being locked out.",
            accentColor: "#e5484d",
          },
          {
            headline: "Adaptive Verification for Gig Platforms",
            dataPoint:
              "Gig platforms show the highest reverification friction. Drivers and couriers face repeated identity checks that interrupt their livelihood.",
            recommendation:
              "Adaptive risk scoring could reduce unnecessary re-checks while maintaining security, reserving full reverification for genuinely suspicious activity.",
            accentColor: "#878cfe",
          },
          {
            headline: "Fallback Verification Paths",
            dataPoint:
              "Many posts describe being locked out with no alternative method, a single point of failure in the verification flow.",
            recommendation:
              "Offering fallback verification paths (manual review, alternative document types, video-assisted verification) prevents permanent lockout and recovers users that automated systems reject.",
            accentColor: "#010668",
          },
          {
            headline: "Age Verification at Scale",
            dataPoint:
              "Age verification is a growing compliance wave, with platforms rapidly rolling out age estimation and document checks.",
            recommendation:
              "Facial age estimation that balances compliance requirements with minimal false rejection for legitimate users is a fast-growing product opportunity, especially as age gates expand beyond gaming and social media.",
            accentColor: "#bec0fe",
          },
        ]}
      />
    </div>
  );
}
