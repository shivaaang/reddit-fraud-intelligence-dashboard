# Prompt Design

How the classification prompts were designed, tested, and refined across both pipeline passes.

## Pass 1: Boolean Routing

Pass 1 classifies every post with two independent boolean flags — `is_fraud` and `is_idv`. A post can be fraud-only, IDV-only, both, or neither. Two flags instead of one category because many fraud posts also discuss identity verification, and forcing a single label would lose that overlap.

Model: `openai/gpt-oss-120b` via OpenRouter with `json_schema` structured output and `medium` reasoning effort.

### V1 Prompt

The first version had minimal exclusions — a one-line 2FA carve-out and a short list of NEITHER cases.

```
is_idv = true if the post substantively discusses:
- Identity verification, KYC, or age verification experiences (positive or negative)
- Document checks, selfie verification, liveness detection, or facial age estimation
- IDV companies: Persona, Jumio, Onfido, ID.me, Veriff, Sumsub, CLEAR, etc.
- Friction, praise, or discussion about identity verification processes

EXCLUDE from IDV: 2FA/MFA (SMS codes, authenticator apps) proves device access, not identity.

Set BOTH to false for:
- Political "fraud" (election fraud debate, not actual fraud)
- Gaming complaints ("this game is a scam" meaning bad quality)
- Bad-service rants without actual fraud
- Referral/promotional spam mentioning KYC in passing
- Automated bot posts (URL scanners, weekly help threads)
```

#### V1 Results (1,000-post random sample)

| Category | Posts | Correct | Misclassified | Precision |
|----------|-------|---------|---------------|-----------|
| BOTH | 56 | 40 | 16 | 71.4% |
| FRAUD_ONLY | 277 | 233 | 44 | 84.1% |
| IDV_ONLY | 211 | 165 | 46 | 78.2% |
| NEITHER | 456 | 444 | 12 | 97.4% |
| **TOTAL** | **1,000** | **882** | **118** | **88.2%** |

| Flag | Precision | Recall | F1 |
|------|-----------|--------|-----|
| is_fraud | 85.3% | 96.6% | 90.6% |
| is_idv | 79.0% | 96.8% | 87.0% |

#### V1 Error Patterns

1. **2FA/MFA confused with IDV (13 posts):** Account hack recovery stories where "verification" meant SMS codes or authenticator apps. The one-line exclusion wasn't strong enough.
2. **Background checks as IDV (9 posts):** Criminal/driving record screening via Checkr for Uber/DoorDash drivers confused with identity verification.
3. **Referral spam with KYC keywords (11 posts):** "KYC" or "verify identity" in referral bonuses or casino recommendations triggered the IDV flag despite explicit exclusion.
4. **Bot posts / boilerplate (7 posts):** ScamChecker automated responses, CryptoCurrency daily threads with template scam warnings, tracking bots.
5. **SEO spam as "scam reviews" (6 posts):** "Is [Platform] Scam or Legit?" promotional spam posted to unrelated subreddits classified as fraud.
6. **Gig platform disputes (4 posts):** DoorDash/Uber deactivation complaints and pay disputes classified as fraud — bad service, not fraud.

### V2 Prompt

Added an explicit "NOT identity verification" section and expanded the NEITHER exclusions based on V1 errors.

**Changes from V1:**
- Added 4-item "NOT identity verification" section: 2FA/MFA, account recovery, background checks (Checkr/Sterling/HireRight), government document issuance
- Expanded NEITHER to 8 items: added gig worker deactivation disputes, SEO spam pattern, merchant disputes, dating appearance lies

```
NOT identity verification (is_idv = false):
- 2FA/MFA: SMS codes, authenticator apps, backup codes, security keys prove device access, not identity
- Account recovery: providing email, phone, account creation date, or device info to regain access
- Background checks: criminal/driving record screening (Checkr, Sterling, HireRight) verifies history, not identity
- Government document issuance: applying for passports, birth certificates, SSN cards, driver's licenses
```

#### V2 Results (different 1,000-post random sample)

| Category | Posts | Correct | Misclassified | Precision |
|----------|-------|---------|---------------|-----------|
| BOTH | 61 | 40 | 21 | 65.6% |
| FRAUD_ONLY | 265 | 216 | 49 | 81.5% |
| IDV_ONLY | 194 | 159 | 35 | 82.0% |
| NEITHER | 480 | 466 | 14 | 97.1% |
| **TOTAL** | **1,000** | **881** | **119** | **88.1%** |

| Flag | Precision | Recall | F1 |
|------|-----------|--------|-----|
| is_fraud | 81.3% | 97.1% | 88.5% |
| is_idv | 79.6% | 97.1% | 87.5% |

#### V1 vs V2 Comparison

| Metric | V1 | V2 | Delta |
|--------|-----|-----|-------|
| Overall accuracy | 88.2% | 88.1% | -0.1% |
| is_fraud precision | 85.3% | 81.3% | -4.0% |
| is_fraud recall | 96.6% | 97.1% | +0.5% |
| is_idv precision | 79.0% | 79.6% | +0.6% |
| is_idv recall | 96.8% | 97.1% | +0.3% |
| IDV_ONLY precision | 78.2% | 82.0% | +3.8% |

IDV_ONLY precision improved (the background check and 2FA exclusions helped), but overall accuracy was flat. The remaining errors are systematic — the model over-triggers on keyword presence rather than substantive discussion.

### Pass 1 Takeaway

The LLM has a precision ceiling around 80–85% for boolean routing at this prompt complexity. Recall is excellent (97%+). The ~15–20% false positive rate is acceptable because Pass 2 has its own `is_relevant` field that filters these out during deep classification.

---

## Pass 2: Deep Classification

Pass 2 takes every post flagged by Pass 1 and classifies it into structured fields using detailed enum definitions. Two separate prompts — one for fraud, one for IDV — each producing a different schema.

Model: `deepseek/deepseek-v3.2` via OpenRouter with `json_object` response format. Reasoning mode: `low` for fraud, `none` for IDV (see A/B testing section below).

### Design Principles

**Detailed enum descriptions with examples.** Every enum value has a 1-2 sentence definition with concrete examples. Without this, the model guesses based on the label alone and produces inconsistent results. For example, without the description, `business_impersonation` and `phishing` overlap heavily — the description clarifies that business_impersonation is about pretending to be a legitimate entity, while phishing is about deceptive messages with fake links.

**"Other" and "unknown" as explicit options.** Every enum field has an escape hatch. When the model is forced to pick from only specific values, it shoehorns ambiguous posts into the closest match, producing noisy data. "Other" and "unknown" give it permission to be honest about ambiguity.

**`is_relevant` as a second-pass filter.** Pass 1 has a ~15–20% false positive rate. Rather than trying to fix that, each Pass 2 prompt includes an `is_relevant` field that lets the model flag posts that shouldn't have made it through. The instruction "when is_relevant is false, still fill in all other fields" ensures we don't lose data — even borderline posts get classified, and the dashboard can filter on relevance.

**Freeform `tags` for long-tail themes.** Structured fields can't cover everything. Tags like `pig_butchering`, `elderly_victim`, `familial`, `crypto_recovery_scam`, `transgender`, `expat` capture contextual details that would require dozens of additional enum fields. The constraint of 2-5 tags per post prevents tag spam while ensuring at least some contextual signal.

**`notable_quote` for human readability.** A verbatim quote from the post or comments makes the dashboard more compelling. An interviewer can glance at a quote and immediately understand the post's substance without reading the full text.

**Comments marked (OP).** Both prompts end with a note that comments marked "(OP)" are from the original poster. OP comments frequently contain the most important details — the dollar amount lost, the company involved, the resolution — that the original post omits.

### Fraud Taxonomy

**`fraud_type` (13 values):** Covers the fraud spectrum from individual-targeted (identity_theft, phishing, romance_scam) to organized (investment_scam, business_impersonation) to technical (sim_swap, deepfake_ai, data_breach). Key distinctions that required explicit descriptions:

- `identity_theft` vs `account_takeover` — identity theft is about stealing personal information to open *new* accounts; account takeover is about hijacking *existing* accounts. Reddit posts frequently blur this line.
- `business_impersonation` vs `phishing` — business_impersonation is pretending to be a real company (tech support scams, IRS impersonation); phishing is the delivery mechanism (fake links). A tech support scam delivered via phone is business_impersonation, not phishing.
- `document_forgery` — included because it's directly relevant to Persona's product (identity document verification). Fake IDs, passports, and diplomas are a category that identity verification can directly prevent.

**`industry` (13 values):** Where fraud occurs, mapped to platform categories that appear most frequently in the Reddit data. `fintech` is separated from `banking` because the fraud patterns are different — PayPal/Venmo/CashApp scams look nothing like traditional bank fraud.

**`loss_bracket` (7 values):** Logarithmic scale. The distinction between `none` (caught it in time) and `unspecified` (didn't mention an amount) matters for analysis — "none" indicates successful fraud prevention while "unspecified" is missing data.

**`channel` (10 values):** How fraud reaches victims. `messaging_app` is separated from `sms` because platform-based messaging (WhatsApp, Telegram) has different fraud patterns than carrier SMS. Pig butchering typically starts on messaging apps; smishing uses SMS.

### IDV Taxonomy

This is the taxonomy most relevant to Persona's product. The fields are designed to answer: what verification methods cause friction, what kind of friction, and on which platforms.

**`verification_type` (8 values):** The primary verification method discussed. Key design decisions:

- `facial_age_estimation` is separate from `selfie_photo` — age estimation uses AI to guess age from a face *without identifying the person*, while selfie verification matches a face to an ID photo. This distinction matters because age estimation is a newer, less understood technology driving legislative changes (UK Online Safety Act, Australian age verification mandates).
- `liveness_check` is separate from `selfie_photo` — liveness requires active participation (turn head, blink, record video) while selfie is a single photo capture. Liveness checks are a distinct source of friction.
- `phone_verification` explicitly excludes 2FA/MFA — this carries forward the Pass 1 lesson that the model confuses login codes with identity verification unless explicitly told.

**`friction_type` (12 values):** The most analytically important field. Directly maps to product improvement opportunities for an IDV company. Key distinctions:

- `excessive_reverification` vs `too_many_steps` — reverification is being asked to verify *again* over time (daily selfies on gig apps, weekly re-checks); too_many_steps is a single verification flow being overly complex. These are fundamentally different product problems.
- `false_rejection` — when the system incorrectly rejects a legitimate user. This is the highest-stakes friction type for IDV companies because it directly blocks real users. The description explicitly includes appearance changes (weight loss, surgery, aging) causing face match failures.
- `no_alternative_method` — locked out with no recourse. This captures the worst user experience: verification fails, and the platform offers no fallback, no manual review, no support path.
- `info_mismatch` — name changes, expired documents, gender marker updates. Common edge case that rigid systems handle poorly.
- `none` — posts that discuss IDV without expressing friction (news articles, positive reviews). Important for balanced analysis.

**`trigger_reason` (10 values):** What triggered the verification request. Distinguishing `new_account` (onboarding KYC) from `periodic_recheck` (re-verification out of nowhere) from `suspicious_activity` (risk-triggered) matters because each has different user expectations and tolerance for friction.

**`platform_name` (freeform string):** Not an enum — there are too many platforms to enumerate. Freeform capture with null for posts that don't name a specific platform. This enables per-platform analysis in the dashboard.

**`sentiment` (4 values):** Simple polarity. `mixed` exists because many posts praise the concept of verification while criticizing the implementation ("I understand why they need it, but the process is terrible").

### IDV Relevance Boundary

The IDV `is_relevant` definition required the most careful scoping. Several categories of posts mention identity verification but aren't useful for IDV product intelligence:

- **Country-specific government infrastructure** (Aadhaar-PAN linking, EPFO portal, passport police verification) — these are about local bureaucracy, not digital platform verification. But users from those same countries complaining about Coinbase or Uber verification *are* relevant.
- **Referral spam** mentioning KYC as a mechanical step ("sign up, complete KYC, get $10") — not a verification experience.
- **2FA/MFA login codes** — carried forward from the Pass 1 lesson, explicitly excluded again at the Pass 2 level.

### Preprocessing

LLM responses need normalization before Pydantic validation. Common issues handled by `_preprocess()`:

- **String booleans:** `"true"` / `"True"` / `"yes"` → `True`
- **Null-as-string:** `"null"` / `"None"` / `"N/A"` / `""` → `None` (for optional fields)
- **Enum normalization:** `"Identity Theft"` / `"identity-theft"` → `"identity_theft"`
- **Tags as string:** `"elderly_victim, crypto"` → `["elderly_victim", "crypto"]`

~97% of responses pass Pydantic validation on the first attempt. The remaining 3% are retried up to 3 times.

### A/B Testing: Reasoning Modes

Before running the full classification, tested DeepSeek's reasoning modes on 50 IDV posts across 2 rounds:

| Mode | Avg Time | Field Agreement |
|------|----------|-----------------|
| `reasoning: none` | 1.8s | baseline |
| `reasoning: low` | 14.2s | 75.3% match |

75.3% field-level agreement means 1 in 4 fields differ between modes. `none` mode was more specific (fewer "unknown" and "other" values) and 8x faster. `low` mode occasionally caught nuances in ambiguous fraud cases (distinguishing SIM swap from account takeover).

**Decision:** `reasoning: none` for IDV (specificity matters more), `reasoning: low` for fraud (nuance matters more for ambiguous fraud types).

### Pass 2 Result

~30% of Pass 1 positives were marked `is_relevant = false` by Pass 2 — confirming the expected false positive rate from Pass 1's 80–85% precision. The `is_relevant` field allows the dashboard to show only substantive posts while preserving the full classified dataset.

Final counts: 8,739 fraud-relevant posts and 7,720 IDV-relevant posts with full structured classification.
