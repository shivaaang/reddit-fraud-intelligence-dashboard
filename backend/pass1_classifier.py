"""Pass 1: Boolean classification of posts into fraud and IDV categories.

Classifies all posts using two independent boolean flags (is_fraud, is_idv).
Posts can be fraud-only, IDV-only, both, or neither.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from backend.config import PASS1_MODEL
from backend.db import (
    get_unrefiltered_posts, get_unrefiltered_count,
    get_random_unrefiltered_posts, update_post_refilter,
    start_run, finish_run,
)
from backend.llm_client import call_llm
from backend.utils import setup_logger

log = setup_logger("pass1_classifier")

LLM_CONCURRENCY = 20

SYSTEM_PROMPT = """You classify Reddit posts for a fraud & identity-verification intelligence dashboard.

For each post, determine two independent boolean flags:

is_fraud = true if the post substantively discusses:
- Any scam, con, or fraud (financial, identity, romance, investment, employment, etc.)
- Identity theft, account takeover, or credential theft
- Phishing, social engineering, SIM swapping, or deepfakes for deception
- Document forgery, synthetic identities, or data breaches
- Warnings, advice, recovery stories, or news about any of the above

is_idv = true if the post substantively discusses:
- Identity verification, KYC, or age verification experiences (positive or negative)
- Document checks, selfie verification, liveness detection, or facial age estimation
- IDV companies: Persona, Jumio, Onfido, ID.me, Veriff, Sumsub, CLEAR, etc.
- Friction, praise, or discussion about identity verification processes

NOT identity verification (is_idv = false):
- 2FA/MFA: SMS codes, authenticator apps, backup codes, security keys prove device access, not identity
- Account recovery: providing email, phone, account creation date, or device info to regain access
- Background checks: criminal/driving record screening (Checkr, Sterling, HireRight) verifies history, not identity
- Government document issuance: applying for passports, birth certificates, SSN cards, driver's licenses

Both flags CAN be true simultaneously.

Set BOTH flags to false for:
- Political "fraud" (election fraud debate, not actual fraud)
- Gaming complaints ("this game is a scam" meaning bad quality)
- Bad-service rants, merchant disputes, or platform policy complaints without actual fraud
- Gig worker deactivation disputes (DoorDash, Uber, Instacart account issues)
- Referral/promotional spam or casino/gambling recommendations mentioning KYC in passing
- Automated bot posts, boilerplate daily/weekly threads, URL scanners
- SEO spam disguised as reviews ("Is [Platform] a Scam or Legit?" posted to unrelated subreddits)
- Date/appearance lies on dating apps (not fraud in the financial/identity sense)"""

REFILTER_SCHEMA = {
    "name": "pass1_result",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "is_fraud": {
                "type": "boolean",
                "description": "Does this post substantively discuss fraud, scams, or identity theft?",
            },
            "is_idv": {
                "type": "boolean",
                "description": "Does this post substantively discuss identity verification, KYC, or age verification?",
            },
            "confidence": {
                "type": "number",
                "description": "Confidence from 0.0 to 1.0",
            },
        },
        "required": ["is_fraud", "is_idv", "confidence"],
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


def _process_single_post(post: dict) -> dict:
    """Process a single post through LLM. Thread-safe."""
    prompt = _build_user_prompt(post)

    result = call_llm(
        SYSTEM_PROMPT, prompt,
        json_schema=REFILTER_SCHEMA,
        reasoning_effort="medium",
    )

    if result is None:
        log.warning(f"LLM returned no result for post {post['post_id']}")
        update_post_refilter(post["post_id"], is_fraud=None, is_idv=None, confidence=0.0)
        return {"status": "error", "post_id": post["post_id"]}

    is_fraud = result.get("is_fraud", False)
    is_idv = result.get("is_idv", False)
    confidence = float(result.get("confidence", 0.0))

    update_post_refilter(post["post_id"], is_fraud=is_fraud, is_idv=is_idv, confidence=confidence)

    if is_fraud and is_idv:
        status = "both"
    elif is_fraud:
        status = "fraud"
    elif is_idv:
        status = "idv"
    else:
        status = "neither"

    return {"status": status, "post_id": post["post_id"]}


def refilter_batch(posts: list[dict]) -> dict:
    """Refilter a batch of posts using concurrent LLM calls."""
    counts = {"fraud": 0, "idv": 0, "both": 0, "neither": 0, "errors": 0}

    with ThreadPoolExecutor(max_workers=LLM_CONCURRENCY) as executor:
        futures = {
            executor.submit(_process_single_post, post): post
            for post in posts
        }

        for future in as_completed(futures):
            try:
                result = future.result()
                status = result["status"]
                if status == "error":
                    counts["errors"] += 1
                else:
                    counts[status] += 1
            except Exception as e:
                log.error(f"Unexpected error in worker: {e}")
                counts["errors"] += 1

    return counts


def run_refilter(sample_size: int = None):
    """Run Pass 1 refilter.

    Args:
        sample_size: If set, process only this many random posts (for validation).
                     If None, process all unfiltered posts.
    """
    if sample_size:
        posts = get_random_unrefiltered_posts(sample_size)
        total = len(posts)
        log.info(f"Starting refilter on RANDOM SAMPLE of {total} posts ({LLM_CONCURRENCY} workers, medium reasoning)")

        run_id = start_run("refilter_v2", "pass1_sample", {
            "model": PASS1_MODEL, "sample_size": sample_size,
            "concurrency": LLM_CONCURRENCY, "reasoning": "medium",
        })

        # Process sample in one big batch (or chunks if large)
        batch_size = LLM_CONCURRENCY * 2
        totals = {"fraud": 0, "idv": 0, "both": 0, "neither": 0, "errors": 0}
        processed = 0

        for i in range(0, len(posts), batch_size):
            batch = posts[i:i + batch_size]
            counts = refilter_batch(batch)
            for k in totals:
                totals[k] += counts[k]
            processed += len(batch)

            log.info(
                f"Progress: {processed}/{total} | "
                f"Fraud: {totals['fraud']} | IDV: {totals['idv']} | "
                f"Both: {totals['both']} | Neither: {totals['neither']} | "
                f"Errors: {totals['errors']}"
            )

        finish_run(run_id, processed, processed - totals["errors"], totals["errors"])
        _print_summary(totals, total)
        return totals

    else:
        total = get_unrefiltered_count()
        log.info(f"Starting FULL refilter. {total} posts to process ({LLM_CONCURRENCY} workers, medium reasoning)")

        if total == 0:
            log.info("No posts to refilter.")
            return

        run_id = start_run("refilter_v2", "pass1_full", {
            "model": PASS1_MODEL, "total": total,
            "concurrency": LLM_CONCURRENCY, "reasoning": "medium",
        })

        totals = {"fraud": 0, "idv": 0, "both": 0, "neither": 0, "errors": 0}
        processed = 0
        batch_size = LLM_CONCURRENCY * 2

        while True:
            batch = get_unrefiltered_posts(batch_size=batch_size)
            if not batch:
                break

            counts = refilter_batch(batch)
            for k in totals:
                totals[k] += counts[k]
            processed += len(batch)

            remaining = get_unrefiltered_count()
            log.info(
                f"Progress: {processed}/{total} | "
                f"Fraud: {totals['fraud']} | IDV: {totals['idv']} | "
                f"Both: {totals['both']} | Neither: {totals['neither']} | "
                f"Errors: {totals['errors']} | Remaining: {remaining}"
            )

        finish_run(run_id, processed, processed - totals["errors"], totals["errors"])
        _print_summary(totals, total)
        return totals


def _print_summary(totals: dict, total: int):
    relevant = totals["fraud"] + totals["idv"] + totals["both"]
    log.info("=" * 60)
    log.info("REFILTER COMPLETE")
    log.info(f"  Total processed:  {total}")
    log.info(f"  Fraud only:       {totals['fraud']} ({totals['fraud']/total*100:.1f}%)")
    log.info(f"  IDV only:         {totals['idv']} ({totals['idv']/total*100:.1f}%)")
    log.info(f"  Both:             {totals['both']} ({totals['both']/total*100:.1f}%)")
    log.info(f"  Neither:          {totals['neither']} ({totals['neither']/total*100:.1f}%)")
    log.info(f"  Errors:           {totals['errors']}")
    log.info(f"  Total relevant:   {relevant} ({relevant/total*100:.1f}%)")
    log.info("=" * 60)


if __name__ == "__main__":
    run_refilter()
