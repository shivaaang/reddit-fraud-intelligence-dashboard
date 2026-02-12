# Process: How the Pipeline Was Built

This documents the key decisions, experiments, and lessons from building the fraud intelligence data pipeline.

## 1. Data Collection

**Approach:** Reddit's public `.json` endpoints (append `.json` to any Reddit URL). No API key or OAuth required — just rate-limited HTTP GET requests.

**Why Reddit?** Fraud victims post detailed first-person accounts — what happened, how much they lost, which platform was involved, and whether identity verification could have stopped it. No other public source has this density of structured fraud narratives.

**Collection strategy:** 12 search tiers, from high-density fraud subreddits (r/Scams, r/identitytheft) to targeted keyword searches across gig economy, fintech, government, dating, and gambling verticals. Each tier widens the net while the later tiers target specific angles (Persona competitors, privacy concerns, accessibility issues).

**Rate limits:** Reddit's documented limit for unauthenticated requests is 10 RPM. Through testing, the actual sustained limit is ~160 RPM before 429 responses start. We settled on a 2-second delay between requests — fast enough for practical collection, conservative enough to avoid blocks.

**Result:** 40,316 posts collected. 277 pre-filtered out (deleted content, negative scores, empty posts with short titles).

## 2. Pass 1: Boolean Routing

**Design decision:** Two independent boolean flags (`is_fraud`, `is_idv`) instead of a single category. Posts can be fraud-only, IDV-only, both, or neither. This allows the same post to feed into both classification tracks — important because many fraud posts also discuss identity verification.

**Model:** OpenRouter → `openai/gpt-oss-120b` with structured JSON output. Chosen for native structured output support (json_schema response format).

**Prompt engineering:** Two iterations tested on 1000-post random samples each.

- **V1:** Basic prompt with one-line exclusions. 88.2% accuracy overall. Main errors: 2FA/MFA confused with IDV, background checks (Checkr) classified as IDV, referral spam triggering flags.
- **V2:** Added explicit "NOT identity verification" section (2FA, account recovery, background checks, government document issuance) and expanded NEITHER exclusions (gig deactivation disputes, SEO spam, dating app lies). Result: 88.1% accuracy — essentially flat.

**Key takeaway:** The LLM has a precision ceiling around 80–85% for boolean routing at this prompt complexity. Recall is excellent (97%+). The ~15–20% false positive rate is systematic — the model over-triggers on keyword presence rather than substantive discussion. This is acceptable because Pass 2 classification naturally filters out irrelevant posts during deep analysis (the `is_relevant` field).

**Result:** 12,556 fraud-flagged, 10,360 IDV-flagged, 2,154 both, 19,277 neither.

## 3. Comment Collection

**Why comments matter:** Post titles and bodies often lack specifics. Comments — especially from the original poster (OP) — frequently reveal the dollar amount lost, the platform involved, or the resolution. Including top comments as context for Pass 2 significantly improves classification quality.

**Rate limit discovery:** Documented Reddit limit is 10 RPM for unauthenticated. Actual sustained throughput: ~160 RPM. We started at 4-second delays, then cut to 2 seconds after confirming stability.

**Bug fix:** Early runs had a silent data loss bug — when a 429 (rate limit) response was returned, the post was still marked as `comments_fetched = TRUE`. This meant those posts would never be retried. Fixed by returning `None` on API failure and only marking fetched on success.

**Result:** ~100K comments collected across all relevant posts (top 5 per post, sorted by OP-first then score).

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
| Total posts collected | 40,316 |
| Pre-filtered (deleted/empty) | 277 |
| Pass 1: Fraud-flagged | 12,556 |
| Pass 1: IDV-flagged | 10,360 |
| Pass 1: Both | 2,154 |
| Pass 2: Fraud relevant | 8,739 |
| Pass 2: IDV relevant | 7,720 |
