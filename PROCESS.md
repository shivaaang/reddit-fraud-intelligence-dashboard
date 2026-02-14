# Process: How the Pipeline Was Built

This documents the key decisions, experiments, and lessons from building the fraud intelligence data pipeline.

## 1. Data Collection

**Approach:** Reddit's public `.json` endpoints (append `.json` to any Reddit URL). No API key or OAuth required — just rate-limited HTTP GET requests.

**Why Reddit?** Fraud victims post detailed first-person accounts — what happened, how much they lost, which platform was involved, and whether identity verification could have stopped it. No other public source has this density of structured fraud narratives.

**Collection strategy:** 21 search tiers in two phases:
- **Tiers 1–12 (original):** High-density fraud subreddits (r/Scams, r/identitytheft) → keyword searches across fintech, government, dating, gambling verticals → global cross-Reddit queries → Persona competitors and privacy concerns. ~40,300 posts.
- **Tiers 13–21 (enhanced, IDV-focused):** Targeted subreddit-specific searches for identity verification content — social media IDV (Facebook, Instagram), gaming age verification (Roblox, CharacterAI), expanded gig economy, crypto KYC, freelancing platforms, financial IDV, and AI/tech platform verification. ~9,200 additional posts.

The enhanced tiers were added after initial analysis showed the IDV dataset was underrepresenting certain verticals (gaming, social media, crypto KYC). These tiers use subreddit-restricted keyword searches to collect posts that mention verification terms within specific communities.

**Rate limits:** Reddit's documented limit for unauthenticated requests is 10 RPM. Through testing, the actual sustained limit is ~160 RPM before 429 responses start. We settled on a 4-second delay between requests for sustained collection, with VPN IP rotation for burst collection sessions.

**Result:** 49,499 posts collected across 7,393 unique subreddits.

## 2. Pass 1: Boolean Routing

**Design decision:** Two independent boolean flags (`is_fraud`, `is_idv`) instead of a single category. Posts can be fraud-only, IDV-only, both, or neither. This allows the same post to feed into both classification tracks — important because many fraud posts also discuss identity verification.

**Model:** OpenRouter → `openai/gpt-oss-120b` with structured JSON output. Chosen for native structured output support (json_schema response format).

**Prompt engineering:** Two iterations tested on 1000-post random samples each.

- **V1:** Basic prompt with one-line exclusions. 88.2% accuracy overall. Main errors: 2FA/MFA confused with IDV, background checks (Checkr) classified as IDV, referral spam triggering flags.
- **V2:** Added explicit "NOT identity verification" section (2FA, account recovery, background checks, government document issuance) and expanded NEITHER exclusions (gig deactivation disputes, SEO spam, dating app lies). Result: 88.1% accuracy — essentially flat.

**Key takeaway:** The LLM has a precision ceiling around 80–85% for boolean routing at this prompt complexity. Recall is excellent (97%+). The ~15–20% false positive rate is systematic — the model over-triggers on keyword presence rather than substantive discussion. This is acceptable because Pass 2 classification naturally filters out irrelevant posts during deep analysis (the `is_relevant` field).

**Result (original tiers 1–12):** 12,556 fraud-flagged, 10,360 IDV-flagged, 2,154 both, 19,277 neither.

### Pass 1b: IDV-Only Classifier (Enhanced Tiers)

Posts from the enhanced collection tiers (13–21) were all gathered via IDV-targeted keyword searches, so they only needed IDV classification — not the dual fraud/IDV routing of the original Pass 1.

**Model:** DeepSeek V3.2 via OpenRouter (`reasoning: none`, 30 concurrent workers). Chosen over GPT-OSS-120B because these posts only needed a single boolean (`is_idv`) rather than two flags, making the simpler/faster model sufficient.

**Prompt design:** The IDV-only prompt is more aggressive with exclusions than the original Pass 1 prompt. Since every post in the enhanced tiers already contains verification-related keywords (they were collected via keyword search), the classifier's job is to distinguish *substantive IDV discussion* from noise. The exclusion list covers: 2FA/MFA, account recovery, background checks, government document issuance, business/page/creator verification, email/phone verification, colloquial "verify", account deactivation for non-identity reasons, India-specific government identity infrastructure, passing mentions, referral spam, and anti-cheat systems.

**Result:** 8,779 posts processed. 4,235 classified as IDV-relevant (48.3%), 4,544 not relevant. Combined with the original tiers: 14,595 total IDV-flagged posts.

## 3. Comment Collection

**Why comments matter:** Post titles and bodies often lack specifics. Comments — especially from the original poster (OP) — frequently reveal the dollar amount lost, the platform involved, or the resolution. Including top comments as context for Pass 2 significantly improves classification quality.

**Rate limit discovery:** Documented Reddit limit is 10 RPM for unauthenticated. Actual sustained throughput: ~160 RPM. We started at 4-second delays, then cut to 2 seconds after confirming stability.

**Bug fix:** Early runs had a silent data loss bug — when a 429 (rate limit) response was returned, the post was still marked as `comments_fetched = TRUE`. This meant those posts would never be retried. Fixed by returning `None` on API failure and only marking fetched on success.

**Result:** 81,662 comments collected across 22,015 relevant posts (top 5 per post, sorted by score).

## 4. Pass 2: Model Selection

**Model:** DeepSeek V3.2 via OpenRouter API. Chosen for two reasons:

1. **Speed:** API calls with ThreadPoolExecutor (20 workers) processes ~500 posts/hour
2. **Consistency:** Pydantic strict validation on every response ensures enum compliance

DeepSeek V3.2 was chosen specifically because it supports `json_object` response format and produces well-structured output at low temperature.

## 5. Pass 2: A/B Testing

Before full classification, tested DeepSeek's reasoning modes on 50 IDV posts across 2 rounds:

| Mode | Avg Time | Field Agreement |
|------|----------|-----------------|
| `reasoning: none` | 1.8s | baseline |
| `reasoning: low` | 14.2s | 75.3% match |

**Findings:**
- 75.3% field-level agreement between modes (meaning 1 in 4 fields differ)
- `none` mode was more specific — fewer "unknown" and "other" values
- `none` mode 8x faster
- `low` mode occasionally caught nuances in fraud posts (distinguishing SIM swap from account takeover)

**Decision:** `reasoning: none` for IDV (where specificity matters more), `reasoning: low` for fraud (where nuance matters more for ambiguous fraud types).

## 6. Pass 2: Relevance Filtering

~30% of Pass 1 positives were marked `is_relevant = false` by Pass 2. These are Pass 1 false positives — posts that mention fraud/IDV keywords but aren't substantively about those topics.

Examples:
- A post in r/personalfinance about credit score disputes flagged as fraud
- A referral bonus post mentioning "complete KYC" flagged as IDV
- A gaming subreddit post calling a game "a scam" flagged as fraud

The `is_relevant` field in both classification tables tracks this, allowing the dashboard to filter to only substantive posts.

**Pydantic validation:** Every API response is validated against strict Pydantic models with `Literal` types for enum fields and `ConfigDict(extra="forbid")`. Common LLM quirks (string booleans, capitalized enums, null-as-string) are preprocessed before validation. ~97% of responses pass on first attempt.

## 7. Final Numbers

| Metric | Count |
|--------|-------|
| Total posts collected | 49,499 |
| Unique subreddits | 7,393 |
| Total comments | 81,662 |
| Pass 1: Fraud-flagged | 12,556 |
| Pass 1: IDV-flagged | 14,595 |
| Pass 1: Both | 2,154 |
| Pass 2: Fraud classified | 12,556 |
| Pass 2: Fraud relevant | 8,739 |
| Pass 2: IDV classified | 14,595 |
| Pass 2: IDV relevant | 11,737 |
| **Total confirmed relevant** | **20,476** |
