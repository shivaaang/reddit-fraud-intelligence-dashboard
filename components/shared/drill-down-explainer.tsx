"use client";

import { toTitleCase } from "@/lib/utils";

/**
 * Contextual descriptions for each dimension value.
 * Explains what the user clicked on: a concise definition
 * that grounds the drill-down in meaning.
 */

const FRAUD_TYPE_DESCRIPTIONS: Record<string, string> = {
  account_takeover:
    "Account takeover occurs when attackers gain unauthorized access to a user's existing account, typically through stolen credentials, SIM swapping, or social engineering. Victims often discover it only after funds are drained or personal information is changed.",
  identity_theft:
    "Identity theft involves using someone's personal information (name, SSN, date of birth) to open new accounts, file false tax returns, or commit fraud in the victim's name. The damage often extends far beyond the initial financial loss.",
  phishing:
    "Phishing uses deceptive messages like emails, texts, and fake websites to trick people into revealing credentials or sensitive information. It remains the most common entry point for more sophisticated fraud schemes.",
  payment_fraud:
    "Payment fraud encompasses unauthorized transactions: stolen credit cards, fraudulent charges, fake payment processors, and checkout manipulation. It spans both online and in-person channels.",
  romance_scam:
    "Romance scams exploit emotional connections built through dating platforms or social media. Scammers invest weeks or months building trust before requesting money, often through untraceable methods like gift cards or crypto.",
  investment_scam:
    "Investment scams lure victims with promises of high returns, including cryptocurrency schemes, fake trading platforms, and Ponzi structures. Losses tend to be among the highest of any fraud type.",
  employment_scam:
    "Employment scams target job seekers with fake job offers, often requesting personal information or upfront payments for equipment, training, or background checks that never materialize.",
  deepfake_ai:
    "AI-powered fraud uses deepfakes, voice cloning, and AI-generated content to impersonate trusted individuals. This rapidly evolving threat makes traditional verification methods increasingly unreliable.",
  sim_swap:
    "SIM swap fraud involves convincing a mobile carrier to transfer a victim's phone number to a new SIM card, giving attackers control over two-factor authentication and account recovery flows.",
  data_breach:
    "Data breach discussions involve incidents where personal information was exposed or stolen from organizations, leading to downstream fraud, account compromises, and identity theft.",
  business_impersonation:
    "Business impersonation fraud involves scammers posing as legitimate companies (banks, government agencies, tech support) to extract payments or credentials from unsuspecting victims.",
  document_forgery:
    "Document forgery involves creating or altering identity documents like IDs, passports, and bank statements to bypass verification systems or establish fraudulent identities.",
  crypto_fraud:
    "Crypto fraud spans rug pulls, fake exchanges, wallet drainers, and social engineering schemes targeting cryptocurrency holders. The irreversible nature of blockchain transactions makes recovery nearly impossible.",
};

const INDUSTRY_DESCRIPTIONS: Record<string, string> = {
  banking:
    "Banking fraud targets traditional financial institutions: checking and savings accounts, credit cards, wire transfers, and loan applications. It represents some of the highest-volume and most financially damaging fraud categories.",
  fintech:
    "Fintech fraud targets digital-first financial services like payment apps, neobanks, and lending platforms. The speed and automation that make fintech convenient also create new attack surfaces.",
  crypto:
    "Crypto industry fraud encompasses exchange scams, wallet compromises, DeFi exploits, and social engineering targeting cryptocurrency holders. The pseudonymous nature of blockchain adds complexity to fraud investigation.",
  ecommerce:
    "E-commerce fraud targets online retail: fake storefronts, stolen payment methods, refund abuse, and marketplace scams. Both buyers and sellers are commonly victimized.",
  social_media:
    "Social media fraud uses platforms like Facebook, Instagram, and TikTok as vectors for scams, impersonation, and phishing. The trust inherent in social connections is routinely exploited.",
  gig_economy:
    "Gig economy fraud targets ride-share drivers, delivery couriers, and freelancers, both through fake job offers and through account compromises that steal earned wages.",
  government:
    "Government-related fraud includes unemployment benefit scams, tax refund fraud, and impersonation of government agencies to extract personal information or payments from victims.",
  telecom:
    "Telecom fraud spans SIM swap attacks, unauthorized account changes, and carrier-based scams. Control of a phone number is often the gateway to broader account compromise.",
  healthcare:
    "Healthcare fraud involves insurance scams, fake provider billing, stolen patient identities, and fraudulent prescription schemes. Medical identity theft can have lasting consequences beyond financial loss.",
  real_estate:
    "Real estate fraud targets high-value transactions: wire fraud during home purchases, fake rental listings, and title theft. The large sums involved make it particularly devastating.",
  gaming:
    "Gaming fraud targets online games and platforms: account theft, virtual currency scams, phishing through game chat, and marketplace manipulation.",
  dating:
    "Dating platform fraud uses romantic connections as a vector for financial exploitation. Romance scams, catfishing, and sextortion are the most common patterns.",
};

const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  email:
    "Email remains the most common delivery channel for fraud: phishing links, business email compromise, fake invoices, and impersonation campaigns. Its ubiquity makes it a persistent threat vector.",
  phone:
    "Phone-based fraud uses voice calls to impersonate banks, government agencies, or tech support. The real-time nature of phone calls creates urgency that overrides victims' skepticism.",
  sms:
    "SMS-based fraud (smishing) uses text messages to deliver phishing links, fake delivery notifications, and bank alert scams. The trusted nature of text messaging makes it effective.",
  social_media:
    "Social media channels are used to deliver scams through direct messages, fake ads, impersonation accounts, and compromised profiles. Trust in social connections is a key exploit vector.",
  messaging_app:
    "Messaging apps like WhatsApp, Telegram, and Discord are used for targeted scams, fake investment groups, and social engineering. End-to-end encryption can make these harder to detect.",
  website:
    "Website-based fraud uses fake or cloned sites to capture credentials, payment information, or personal data. Lookalike domains and HTTPS certificates create a false sense of security.",
  app:
    "App-based fraud involves malicious applications, fake app store listings, and in-app scams that exploit mobile users' trust in their device ecosystem.",
  in_person:
    "In-person fraud involves face-to-face deception: impersonating utility workers, delivery personnel, or officials to gain access to homes or extract payments.",
  mail:
    "Physical mail fraud uses postal service for fake checks, phishing letters impersonating organizations, and identity theft through stolen mail.",
};

const LOSS_BRACKET_DESCRIPTIONS: Record<string, string> = {
  none: "Posts where no financial loss was reported. These often describe attempted fraud that was caught in time, or discussions about fraud methods and awareness.",
  under_100:
    "Small-dollar fraud under $100, often involving subscription scams, small unauthorized charges, or low-value gift card schemes. High volume but individually recoverable.",
  "100_to_1k":
    "Moderate losses between $100 and $1,000, common in payment fraud, marketplace scams, and phishing attacks. Large enough to cause real hardship but often below fraud investigation thresholds.",
  "1k_to_10k":
    "Significant losses between $1,000 and $10,000, often involving account takeover, investment scams, or business email compromise. These cases frequently drive victims to seek help online.",
  "10k_to_100k":
    "Major losses between $10,000 and $100,000, typically from romance scams, real estate wire fraud, or sophisticated investment schemes. Life-altering amounts for most victims.",
  over_100k:
    "Catastrophic losses exceeding $100,000. The most devastating cases, often involving long-running romance scams, investment fraud, or business impersonation targeting life savings and retirement funds.",
  unspecified:
    "Posts where the financial impact was discussed but a specific dollar amount was not mentioned. The focus tends to be on the emotional toll and recovery process rather than exact figures.",
};

const FRICTION_TYPE_DESCRIPTIONS: Record<string, string> = {
  false_rejection:
    "False rejection occurs when a legitimate user is incorrectly denied verification. The system says they are not who they claim to be. This is the core tension in identity verification: every false rejection is a real customer locked out of their own account.",
  technical_failure:
    "Technical failures involve system errors during verification: camera malfunctions, upload timeouts, processing errors, or app crashes that prevent users from completing the verification flow.",
  too_slow:
    "Verification processes that take too long: extended review periods, manual review queues, or multi-day waiting times that leave users unable to access their accounts or services.",
  too_many_steps:
    "Excessive verification steps that create friction fatigue: multiple document uploads, repeated selfies, additional forms, and redundant information requests that wear down user patience.",
  excessive_reverification:
    "Users being asked to verify their identity repeatedly, triggered by routine logins, device changes, or periodic rechecks. Particularly frustrating for gig workers who depend on platform access for their livelihood.",
  privacy_concern:
    "Users uncomfortable with the personal data required for verification: government ID photos, biometric data, facial recognition, or social security numbers. Reflects growing tension between security requirements and data minimization.",
  accessibility_issue:
    "Verification systems that fail users with disabilities, non-standard appearances, or non-Latin name characters. Document readers that can't parse certain ID formats, or facial recognition that struggles with diverse faces.",
  info_mismatch:
    "Verification failures caused by mismatches between a user's submitted information and records: name changes, address updates, or discrepancies between ID documents and platform data.",
  no_alternative_method:
    "Users locked out with no backup verification path. When the primary method fails and no fallback (manual review, alternative document, video call) is available, it creates a single point of failure in the verification flow.",
  country_restriction:
    "Verification systems that cannot process documents from certain countries or regions, limiting access for international users or immigrants whose identity documents are not in the system's supported set.",
  none: "General identity verification discussions without a specific friction complaint. Broader conversations about verification processes, comparisons between platforms, or informational posts.",
};

const VERIFICATION_TYPE_DESCRIPTIONS: Record<string, string> = {
  document_upload:
    "Document-based verification where users photograph or scan identity documents: passports, driver's licenses, or national IDs. The most common first step in identity verification flows.",
  selfie_photo:
    "Selfie matching where users take a photo of their face to compare against their identity document. Susceptible to lighting conditions, camera quality, and changes in appearance over time.",
  liveness_check:
    "Liveness detection requires users to prove they are physically present, not a photo, video, or deepfake. Typically involves turning the head, blinking, or following on-screen prompts.",
  facial_age_estimation:
    "Facial age estimation uses AI to estimate a user's age from their appearance. Increasingly deployed for age-gated content and services, but accuracy varies across demographics.",
  knowledge_based:
    "Knowledge-based verification asks users questions derived from their credit or public records: previous addresses, loan amounts, or account history. Increasingly vulnerable to data breaches making answers publicly available.",
  database_lookup:
    "Backend database verification that checks submitted information against government or commercial databases without requiring the user to upload documents. Fastest but dependent on data freshness.",
  phone_verification:
    "Phone-based verification using SMS codes, voice calls, or carrier-based identity signals. Common for two-factor authentication but vulnerable to SIM swap attacks.",
};

const TRIGGER_REASON_DESCRIPTIONS: Record<string, string> = {
  new_account:
    "Verification triggered during account creation, the onboarding flow where new users must prove their identity before accessing the platform. The first impression of a platform's verification experience.",
  age_gate:
    "Verification triggered by age-restricted content or services: social media age requirements, alcohol delivery, gambling platforms, or content rating systems. A fast-growing compliance area.",
  account_recovery:
    "Verification triggered when users attempt to regain access to a locked or compromised account. Often the most stressful context for verification, as users are already in a crisis state.",
  periodic_recheck:
    "Verification triggered as a routine re-check. Platforms periodically asking existing users to re-verify, often without clear explanation. Particularly frustrating for gig economy workers.",
  suspicious_activity:
    "Verification triggered by unusual account behavior: login from a new location, large transactions, rapid password changes, or other signals that suggest potential unauthorized access.",
  transaction:
    "Verification triggered by a specific transaction: large transfers, cryptocurrency purchases, or high-value orders that exceed risk thresholds and require additional identity confirmation.",
  policy_change:
    "Verification triggered by a change in platform policy or regulatory requirements: new compliance mandates, updated terms of service, or expanded KYC obligations.",
  document_update:
    "Verification triggered because existing identity documents on file have expired or need updating: driving license renewals, passport expirations, or address changes.",
  new_device_location:
    "Verification triggered by a login from an unrecognized device or location. A security measure that can frustrate legitimate users who travel or switch devices frequently.",
  unknown:
    "Discussions where the reason for verification was not clearly specified by the user. The focus tends to be on the verification experience itself rather than what triggered it.",
};

const SENTIMENT_DESCRIPTIONS: Record<string, string> = {
  negative:
    "Posts expressing frustration, anger, or disappointment with identity verification. Users who feel wronged by the process, locked out unfairly, or exhausted by excessive requirements.",
  positive:
    "Posts with favorable views of identity verification. Users who appreciate the security, had smooth experiences, or support verification as a necessary protection measure.",
  neutral:
    "Posts that discuss identity verification without strong emotional charge. Informational questions, comparisons, or matter-of-fact descriptions of the process.",
  mixed:
    "Posts that express both positive and negative views. Users who understand why verification exists but are frustrated with how it's implemented.",
};

interface DrillDownExplainerProps {
  type: "fraud" | "idv";
  dimension: string;
  value: string;
}

function getDescription(
  type: "fraud" | "idv",
  dimension: string,
  value: string
): string | null {
  if (type === "fraud") {
    if (dimension === "fraud_type") return FRAUD_TYPE_DESCRIPTIONS[value] ?? null;
    if (dimension === "industry") return INDUSTRY_DESCRIPTIONS[value] ?? null;
    if (dimension === "channel") return CHANNEL_DESCRIPTIONS[value] ?? null;
    if (dimension === "loss_bracket") return LOSS_BRACKET_DESCRIPTIONS[value] ?? null;
  }

  if (type === "idv") {
    if (dimension === "friction_type") return FRICTION_TYPE_DESCRIPTIONS[value] ?? null;
    if (dimension === "verification_type") return VERIFICATION_TYPE_DESCRIPTIONS[value] ?? null;
    if (dimension === "trigger_reason") return TRIGGER_REASON_DESCRIPTIONS[value] ?? null;
    if (dimension === "sentiment") return SENTIMENT_DESCRIPTIONS[value] ?? null;
    if (dimension === "platform_name") {
      return `How users on Reddit describe the identity verification experience on ${value}: what verification methods they encounter, what friction they experience, and how they feel about the process.`;
    }
  }

  // Tags (both tabs)
  if (dimension === "tag") {
    return `Posts tagged with "${toTitleCase(value)}", exploring how this theme appears across the ${type === "fraud" ? "fraud landscape" : "identity verification"} data.`;
  }

  return null;
}

export function DrillDownExplainer({
  type,
  dimension,
  value,
}: DrillDownExplainerProps) {
  const description = getDescription(type, dimension, value);

  if (!description) return null;

  const borderColor =
    type === "fraud" ? "border-l-ube-400" : "border-l-ube-300";

  return (
    <div
      className={`border-l-4 ${borderColor} bg-fog-100 rounded-lg p-5 pl-6`}
    >
      <p className="text-sm text-fog-600 leading-relaxed">{description}</p>
    </div>
  );
}
