"""Phase 4: Deep LLM classification of relevant posts."""

import time
from backend.config import LLM_BATCH_SIZE, OPENROUTER_MODEL
from backend.db import (
    get_unclassified_posts, get_top_comments_for_post,
    insert_classification, start_run, finish_run,
    get_conn, get_cursor,
)
from backend.openrouter_client import call_llm
from backend.utils import setup_logger

log = setup_logger("classifier")

SYSTEM_PROMPT = """You are an expert fraud analyst classifying Reddit posts for a fraud intelligence dashboard. You will be given a Reddit post and its top comments. Extract structured information about the fraud or security topic discussed.

CLASSIFICATION FIELDS:

1. fraud_type: Choose the BEST match from this list:
   - identity_theft: Someone's personal information was stolen or used without consent
   - account_takeover: An existing online account was hijacked/compromised
   - phishing: Deceptive messages designed to steal credentials or personal info
   - deepfake_ai: AI-generated images, video, voice, or documents used for fraud
   - document_forgery: Fake IDs, passports, documents, certificates
   - synthetic_identity: Fabricated identity combining real and fake information
   - sim_swap: Phone number ported without authorization to bypass 2FA
   - business_impersonation: Pretending to be a legitimate company or organization
   - romance_scam: Fraudulent romantic relationship to extract money
   - investment_scam: Fake investment opportunities (crypto, stocks, forex, Ponzi)
   - payment_fraud: Unauthorized transactions, card fraud, chargeback fraud
   - employment_scam: Fake job offers designed to steal money or personal info
   - age_verification_bypass: Minors circumventing age restrictions
   - credential_stuffing: Using leaked credentials to access accounts
   - social_engineering: Psychological manipulation to extract info or access
   - data_breach: Personal data exposed through a security breach
   - other: Doesn't clearly fit any above category

2. fraud_type_secondary: If the post covers TWO fraud types (e.g., phishing leading to account takeover), provide the secondary type. Otherwise null.

3. fraud_vector: One or two sentences describing HOW the fraud was executed or attempted. Be specific.

4. severity: Based on impact described:
   - low: Minor inconvenience, no financial loss, easily resolved
   - medium: Some financial loss (<$1,000) or moderate effort to resolve
   - high: Significant financial loss ($1,000-$10,000) or major life disruption
   - critical: Severe financial loss (>$10,000), legal consequences, or ongoing harm

5. financial_loss_mentioned: true/false
6. loss_amount_usd: Number if mentioned, null if not. Convert to USD if another currency is mentioned.

7. industry: Best match from:
   banking_finance, cryptocurrency, ecommerce, gig_economy, social_media, government, telecom, healthcare, real_estate, employment, gaming, education, travel, general, other

8. platform_mentioned: Specific platform name if mentioned (e.g., "PayPal", "Coinbase"). null if none.

9. geographic_region: If location is mentioned (e.g., "United States", "UK"). null if not.

10. involves_ai: true if the fraud uses AI, deepfakes, synthetic media, AI-generated text. false otherwise.
11. ai_technique_mentioned: Specific AI technique if mentioned. null if not applicable.

12. verification_mentioned: true if the post mentions identity verification, KYC, age verification, document checks, selfie verification, liveness detection, or similar.
13. verification_type: If verification_mentioned, what kind? Options: "document_check", "selfie_match", "liveness_detection", "database_lookup", "biometric", "knowledge_based", "multi_factor", "age_check", "other", null
14. verification_sentiment: If verification_mentioned: "positive", "negative", "neutral", null
15. verification_context: If verification_mentioned, one sentence about the verification aspect. null otherwise.

16. post_type: What kind of post is this?
    - victim_report: Person reporting they were a victim
    - warning: Someone warning others about a specific scam
    - question: Someone asking if something is a scam or how to protect themselves
    - discussion: General discussion or analysis of fraud trends
    - news: Sharing a news article about fraud/security
    - advice: Giving advice on fraud prevention or recovery
    - rant: Frustrated venting about fraud experience or verification experience

17. victim_sentiment: If a victim is involved:
    frustrated, scared, angry, hopeful, resolved, warning_others, neutral

18. resolution_status: If mentioned:
    unresolved, resolved, in_progress, unknown

19. summary: Write 2-3 sentences summarizing the post. Focus on what happened, how, and the outcome.

Respond with ONLY valid JSON. Every field must be present. Use null for unavailable information."""

_FRAUD_TYPES = [
    "identity_theft", "account_takeover", "phishing", "deepfake_ai",
    "document_forgery", "synthetic_identity", "sim_swap",
    "business_impersonation", "romance_scam", "investment_scam",
    "payment_fraud", "employment_scam", "age_verification_bypass",
    "credential_stuffing", "social_engineering", "data_breach", "other",
]

_INDUSTRIES = [
    "banking_finance", "cryptocurrency", "ecommerce", "gig_economy",
    "social_media", "government", "telecom", "healthcare", "real_estate",
    "employment", "gaming", "education", "travel", "general", "other",
]

CLASSIFICATION_SCHEMA = {
    "name": "classification_result",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "fraud_type": {
                "type": "string",
                "enum": _FRAUD_TYPES,
                "description": "Primary fraud type",
            },
            "fraud_type_secondary": {
                "type": ["string", "null"],
                "description": "Secondary fraud type if post covers two types, otherwise null",
            },
            "fraud_vector": {
                "type": "string",
                "description": "1-2 sentences: HOW the fraud was executed or attempted",
            },
            "severity": {
                "type": "string",
                "enum": ["low", "medium", "high", "critical"],
            },
            "financial_loss_mentioned": {"type": "boolean"},
            "loss_amount_usd": {
                "type": ["number", "null"],
                "description": "Dollar amount if mentioned, null otherwise",
            },
            "industry": {
                "type": "string",
                "enum": _INDUSTRIES,
            },
            "platform_mentioned": {
                "type": ["string", "null"],
                "description": "Specific platform name (e.g. PayPal, Coinbase) or null",
            },
            "geographic_region": {"type": ["string", "null"]},
            "involves_ai": {"type": "boolean"},
            "ai_technique_mentioned": {"type": ["string", "null"]},
            "verification_mentioned": {
                "type": "boolean",
                "description": "Does the post mention identity verification, KYC, or similar?",
            },
            "verification_type": {
                "type": ["string", "null"],
                "enum": [
                    "document_check", "selfie_match", "liveness_detection",
                    "database_lookup", "biometric", "knowledge_based",
                    "multi_factor", "age_check", "other", None,
                ],
            },
            "verification_sentiment": {
                "type": ["string", "null"],
                "enum": ["positive", "negative", "neutral", None],
            },
            "verification_context": {"type": ["string", "null"]},
            "post_type": {
                "type": "string",
                "enum": [
                    "victim_report", "warning", "question",
                    "discussion", "news", "advice", "rant",
                ],
            },
            "victim_sentiment": {
                "type": ["string", "null"],
                "enum": [
                    "frustrated", "scared", "angry", "hopeful",
                    "resolved", "warning_others", "neutral", None,
                ],
            },
            "resolution_status": {
                "type": ["string", "null"],
                "enum": ["unresolved", "resolved", "in_progress", "unknown", None],
            },
            "summary": {
                "type": "string",
                "description": "2-3 sentence summary of what happened, how, and the outcome",
            },
        },
        "required": [
            "fraud_type", "fraud_type_secondary", "fraud_vector",
            "severity", "financial_loss_mentioned", "loss_amount_usd",
            "industry", "platform_mentioned", "geographic_region",
            "involves_ai", "ai_technique_mentioned",
            "verification_mentioned", "verification_type",
            "verification_sentiment", "verification_context",
            "post_type", "victim_sentiment", "resolution_status",
            "summary",
        ],
        "additionalProperties": False,
    },
}


def _format_comments(comments: list[dict]) -> str:
    if not comments:
        return "(No comments available)"

    parts = []
    for i, c in enumerate(comments, 1):
        author = c.get("author") or "[deleted]"
        score = c.get("score", 0)
        body = (c.get("body") or "").strip()
        # Truncate very long comments
        if len(body) > 500:
            body = body[:500] + "..."
        parts.append(f"[Comment {i} | Score: {score} | By: {author}]\n{body}")

    return "\n\n".join(parts)


def _build_user_prompt(post: dict, comments: list[dict]) -> str:
    body = (post["selftext"] or "").strip()
    if len(body) > 3000:
        body = body[:3000] + "\n[...truncated]"

    formatted_comments = _format_comments(comments)
    created = post.get("created_utc", "unknown")

    return f"""Classify this Reddit post and its comments:

SUBREDDIT: r/{post['subreddit']}
TITLE: {post['title']}
POST BODY:
{body}

TOP COMMENTS:
{formatted_comments}

POST METADATA:
Score: {post['score']} | Comments: {post['num_comments']} | Posted: {created}"""


def classify_batch(posts: list[dict], use_schema: bool = True) -> dict:
    """Classify a batch of posts. Returns stats."""
    success = 0
    errors = 0

    for post in posts:
        comments = get_top_comments_for_post(post["post_id"], limit=8)
        prompt = _build_user_prompt(post, comments)
        schema = CLASSIFICATION_SCHEMA if use_schema else None

        result = call_llm(
            SYSTEM_PROMPT, prompt,
            max_tokens=800,
            json_schema=schema,
        )

        if result is None:
            log.warning(f"Classification failed for post {post['post_id']}")
            errors += 1
            continue

        insert_classification(post["post_id"], result, OPENROUTER_MODEL)
        success += 1

        time.sleep(0.5)

    return {"success": success, "errors": errors}


def run_classification(use_schema: bool = True):
    """Classify all relevant posts that haven't been classified yet."""
    # Get total count first
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT COUNT(*) as cnt FROM raw_posts
                WHERE is_relevant = TRUE AND classification_done = FALSE
            """)
            total = cur.fetchone()["cnt"]

    log.info(f"Starting classification. {total} posts to classify.")

    if total == 0:
        log.info("No posts to classify.")
        return

    run_id = start_run("initial_collection", "classification",
                       {"model": OPENROUTER_MODEL, "total": total})

    total_success = 0
    total_errors = 0
    processed = 0

    while True:
        batch = get_unclassified_posts(batch_size=LLM_BATCH_SIZE)
        if not batch:
            break

        stats = classify_batch(batch, use_schema=use_schema)
        total_success += stats["success"]
        total_errors += stats["errors"]
        processed += len(batch)

        log.info(
            f"Progress: {processed}/{total} processed | "
            f"Success: {total_success} | Errors: {total_errors}"
        )

    finish_run(run_id, processed, total_success, total_errors)
    log.info(
        f"Classification complete. "
        f"Success: {total_success}, Errors: {total_errors}"
    )


if __name__ == "__main__":
    run_classification()
