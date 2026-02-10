"""Phase 2: LLM-based relevance filtering of raw posts."""

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from backend.config import RELEVANCE_CONFIDENCE_THRESHOLD, LLM_BATCH_SIZE, OPENROUTER_MODEL
from backend.db import (
    get_unfiltered_posts, get_unfiltered_count,
    update_post_relevance, start_run, finish_run,
)
from backend.openrouter_client import call_llm
from backend.utils import setup_logger

log = setup_logger("relevance_filter")

# Number of concurrent LLM calls
LLM_CONCURRENCY = 20

SYSTEM_PROMPT = """You are a data classification assistant for a fraud intelligence research project focused on identity fraud, online scams, and identity verification.

Your task is to determine whether a Reddit post is RELEVANT to this research, and if relevant, assign it a category.

A post is RELEVANT if it is PRIMARILY about ANY of these topics:
1. Any type of fraud, scam, or con (financial, identity, romance, investment, etc.)
2. Identity theft — someone's personal info used without consent
3. Account takeover — someone's online account was compromised
4. Phishing, social engineering, or credential theft
5. Deepfakes or AI used for deception, impersonation, or fraud
6. Document forgery or fake identity documents
7. Cybersecurity incidents affecting personal/financial data
8. Identity verification, KYC (Know Your Customer), or age verification experiences (both positive and negative)
9. SIM swapping, phone number hijacking
10. Warnings or educational content about any of the above
11. News articles or discussions analyzing fraud trends
12. Mentions of identity verification companies (Persona, Jumio, Onfido, ID.me, Veriff, Sumsub, etc.)

A post is IRRELEVANT if it is:
- General financial advice (budgeting, investing, saving) without a fraud angle
- Political discussions that merely use the word "fraud" (e.g., "election fraud" political debate)
- Video game discussions (e.g., "this game is a scam" meaning it's bad)
- Product complaints that aren't about actual fraud (e.g., "this company scammed me" meaning bad service, not actual fraud)
- Fiction, entertainment, or meme content
- General technology discussions without a fraud/security angle
- Cryptocurrency price discussion or trading without fraud involvement
- Privacy philosophy discussions without concrete fraud or verification content

IMPORTANT EDGE CASES:
- If someone complains about identity verification being annoying/difficult, that IS relevant (category: identity_verification)
- If someone describes being locked out of their own account due to verification, that IS relevant
- If a post is about a data breach that exposed personal information, that IS relevant
- If a post asks "how do I protect myself from identity theft," that IS relevant (category: fraud_prevention)
- If a post says "is this a scam?" and describes something suspicious, that IS relevant

CATEGORY DEFINITIONS (only assign if relevant=true):
- fraud_report: Someone reporting, describing, or warning about a specific fraud, scam, or identity theft incident
- identity_verification: About KYC, identity verification, document checks, selfie verification, liveness detection, age verification experiences (positive or negative)
- competitive_intel: Mentions a specific identity verification company by name (Persona, Jumio, Onfido, ID.me, Veriff, Sumsub, CLEAR, Plaid, Mitek, iProov, etc.)
- fraud_prevention: About protecting oneself from fraud, security advice, recovery steps, or preventive measures
- news_discussion: News article, general analysis, or broad discussion about fraud/security trends"""

RELEVANCE_SCHEMA = {
    "name": "relevance_result",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "relevant": {
                "type": "boolean",
                "description": "Is this post relevant to fraud/identity verification research?",
            },
            "confidence": {
                "type": "number",
                "description": "Confidence from 0.0 to 1.0",
            },
            "topic_hint": {
                "type": "string",
                "description": "3-6 word description of what the post is about",
            },
            "language": {
                "type": "string",
                "description": "ISO 639-1 language code (e.g. en, es, de)",
            },
            "category": {
                "type": ["string", "null"],
                "enum": [
                    "fraud_report",
                    "identity_verification",
                    "competitive_intel",
                    "fraud_prevention",
                    "news_discussion",
                    None,
                ],
                "description": "Category of the post. null if irrelevant.",
            },
        },
        "required": ["relevant", "confidence", "topic_hint", "language", "category"],
        "additionalProperties": False,
    },
}


def _build_user_prompt(post: dict) -> str:
    body = (post["selftext"] or "").strip()
    if len(body) > 5000:
        body = body[:5000] + "\n[...truncated]"

    return f"""Classify this Reddit post:

Subreddit: r/{post['subreddit']}
Title: {post['title']}
Body: {body}
Score: {post['score']} | Comments: {post['num_comments']}"""


def _process_single_post(post: dict, use_schema: bool = True) -> dict:
    """Process a single post through LLM. Thread-safe."""
    prompt = _build_user_prompt(post)
    schema = RELEVANCE_SCHEMA if use_schema else None

    result = call_llm(
        SYSTEM_PROMPT, prompt,
        max_tokens=500,
        json_schema=schema,
        reasoning_effort="low",
    )

    if result is None:
        log.warning(f"LLM returned no result for post {post['post_id']}")
        update_post_relevance(
            post["post_id"],
            is_relevant=None,
            confidence=0.0,
            topic_hint="LLM_PARSE_ERROR",
            language=None,
            category=None,
        )
        return {"status": "error"}

    is_relevant = result.get("relevant", False)
    confidence = float(result.get("confidence", 0.0))
    topic_hint = result.get("topic_hint", "")
    language = result.get("language", "en")
    category = result.get("category")

    if not is_relevant:
        category = None

    if is_relevant and confidence < RELEVANCE_CONFIDENCE_THRESHOLD:
        log.debug(f"Low confidence relevant: {post['post_id']} ({confidence:.2f})")

    update_post_relevance(
        post["post_id"],
        is_relevant=is_relevant,
        confidence=confidence,
        topic_hint=topic_hint,
        language=language,
        category=category,
    )

    return {"status": "relevant" if is_relevant else "irrelevant"}


def filter_batch(posts: list[dict], use_schema: bool = True) -> dict:
    """Filter a batch of posts for relevance using concurrent LLM calls."""
    relevant_count = 0
    irrelevant_count = 0
    error_count = 0

    with ThreadPoolExecutor(max_workers=LLM_CONCURRENCY) as executor:
        futures = {
            executor.submit(_process_single_post, post, use_schema): post
            for post in posts
        }

        for future in as_completed(futures):
            try:
                result = future.result()
                if result["status"] == "relevant":
                    relevant_count += 1
                elif result["status"] == "irrelevant":
                    irrelevant_count += 1
                else:
                    error_count += 1
            except Exception as e:
                log.error(f"Unexpected error in worker: {e}")
                error_count += 1

    return {
        "relevant": relevant_count,
        "irrelevant": irrelevant_count,
        "errors": error_count,
    }


def run_relevance_filter(use_schema: bool = True):
    """Process all unfiltered posts through LLM relevance filter."""
    total_remaining = get_unfiltered_count()
    log.info(f"Starting relevance filter ({LLM_CONCURRENCY} concurrent workers). {total_remaining} posts to process.")

    if total_remaining == 0:
        log.info("No posts to filter.")
        return

    run_id = start_run("initial_collection", "relevance_filter",
                       {"model": OPENROUTER_MODEL, "total": total_remaining,
                        "concurrency": LLM_CONCURRENCY})

    total_relevant = 0
    total_irrelevant = 0
    total_errors = 0
    processed = 0

    # Use larger batch size to feed concurrent workers
    batch_size = LLM_CONCURRENCY * 2

    while True:
        batch = get_unfiltered_posts(batch_size=batch_size)
        if not batch:
            break

        stats = filter_batch(batch, use_schema=use_schema)
        total_relevant += stats["relevant"]
        total_irrelevant += stats["irrelevant"]
        total_errors += stats["errors"]
        processed += len(batch)

        remaining = get_unfiltered_count()
        log.info(
            f"Progress: {processed}/{total_remaining} processed | "
            f"Relevant: {total_relevant} | Irrelevant: {total_irrelevant} | "
            f"Errors: {total_errors} | Remaining: {remaining}"
        )

    finish_run(
        run_id, processed,
        total_relevant + total_irrelevant,
        total_errors,
    )
    log.info(
        f"Relevance filter complete. "
        f"Relevant: {total_relevant}, Irrelevant: {total_irrelevant}, Errors: {total_errors}"
    )


if __name__ == "__main__":
    run_relevance_filter()
