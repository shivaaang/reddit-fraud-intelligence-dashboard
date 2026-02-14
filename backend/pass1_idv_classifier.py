"""Pass 1 IDV classifier: filters enhanced collection posts for identity verification relevance.

Uses DeepSeek V3.2 (no reasoning) to determine is_idv on posts collected from
targeted IDV keyword searches (tiers 13-21). These posts all mention verification-related
terms, so the classifier focuses on distinguishing substantive IDV discussion from noise.

Usage:
    python -m backend.pass1_idv_classifier              # Classify all unfiltered posts
    python -m backend.pass1_idv_classifier sample 50    # Classify random sample of 50
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from backend.db import (
    get_unrefiltered_posts, get_unrefiltered_count,
    get_random_unrefiltered_posts, update_post_refilter,
    start_run, finish_run,
)
from backend.llm_client import call_deepseek
from backend.utils import setup_logger

log = setup_logger("pass1_idv")

LLM_CONCURRENCY = 30

SYSTEM_PROMPT = """You classify Reddit posts for an identity verification intelligence dashboard.

Identity verification (IDV) is the process of proving your real-world identity to a platform by submitting government-issued documents, biometric data, or personal information for validation. It is distinct from authentication (device/account access), background checks (history), and account verification (legitimacy).

Determine whether this post substantively discusses identity verification (IDV).

is_idv = true if the post substantively discusses:
- Identity verification, KYC, or age verification experiences (positive or negative)
- Submitting identity documents (driver's license, passport, national ID) to a platform
- Selfie verification, face matching, or liveness checks on a platform
- Facial age estimation for age-gating (e.g., Yoti, platform age checks)
- IDV companies or providers: Persona, Jumio, Onfido, ID.me, Veriff, Sumsub, CLEAR, Yoti, etc.
- Friction, complaints, praise, or discussion about identity verification processes
- Platform verification policies requiring proof of identity (document upload, selfie, face scan)

is_idv = false if:
- 2FA/MFA: SMS codes, authenticator apps, backup codes, security keys — these prove device access, not identity
- Account recovery: providing email, phone, security questions, or device info to regain access — not identity proof
- Background checks: criminal/driving record screening (Checkr, Sterling, HireRight) — verifies history, not identity
- Government document issuance: applying for passports, birth certificates, SSN cards, driver's licenses — obtaining documents, not verifying identity to a platform
- Business/page/creator verification: social media blue checkmarks, monetization verification, channel verification — proves account authenticity, not personal identity
- Email or phone verification: confirming email/phone during signup or login — routine step, not identity verification
- Colloquial "verify": "can someone verify this?", "I verified it's legit" — not about identity verification
- Account deactivation or suspension for non-identity reasons: low ratings, policy violations, missing deliveries, safety reports
- India-specific government identity infrastructure: Aadhaar, PAN linking, EPFO, DigiLocker, passport police verification — local bureaucracy, not platform IDV
- Passing mentions: post is substantively about something else but mentions verification in one sentence
- Referral spam, promotional content, or bot posts that mention KYC tangentially
- Anti-cheat systems, game bans, or content moderation unrelated to identity verification

Respond with ONLY a JSON object: {"is_idv": true/false, "confidence": 0.0-1.0}"""


def _build_user_prompt(post: dict) -> str:
    body = (post["selftext"] or "").strip()
    if len(body) > 5000:
        body = body[:5000] + "\n[...truncated]"

    return (
        f"Classify this Reddit post:\n\n"
        f"Subreddit: r/{post['subreddit']}\n"
        f"Title: {post['title']}\n"
        f"Body: {body}\n"
        f"Score: {post['score']} | Comments: {post['num_comments']}"
    )


def _process_single_post(post: dict) -> dict:
    """Process a single post through DeepSeek. Thread-safe."""
    prompt = _build_user_prompt(post)

    result = call_deepseek(SYSTEM_PROMPT, prompt, reasoning=None)

    if result is None:
        log.warning(f"LLM returned no result for post {post['post_id']}")
        update_post_refilter(post["post_id"], is_fraud=None, is_idv=None, confidence=0.0)
        return {"status": "error", "post_id": post["post_id"]}

    is_idv = result.get("is_idv", False)
    if isinstance(is_idv, str):
        is_idv = is_idv.strip().lower() in ("true", "yes", "1")

    confidence = float(result.get("confidence", 0.0))

    update_post_refilter(post["post_id"], is_fraud=None, is_idv=is_idv, confidence=confidence)

    return {
        "status": "idv" if is_idv else "not_idv",
        "post_id": post["post_id"],
    }


def classify_batch(posts: list[dict]) -> dict:
    """Classify a batch of posts using concurrent DeepSeek calls."""
    counts = {"idv": 0, "not_idv": 0, "errors": 0}

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


def run_classifier(sample_size: int = None):
    """Run IDV Pass 1 classifier.

    Args:
        sample_size: If set, process only this many random posts (for validation).
                     If None, process all unfiltered posts.
    """
    if sample_size:
        posts = get_random_unrefiltered_posts(sample_size)
        total = len(posts)
        log.info(f"Starting IDV classifier on SAMPLE of {total} posts ({LLM_CONCURRENCY} workers)")

        run_id = start_run("pass1_idv", "sample", {
            "model": "deepseek-v3.2", "sample_size": sample_size,
            "concurrency": LLM_CONCURRENCY,
        })

        batch_size = LLM_CONCURRENCY * 2
        totals = {"idv": 0, "not_idv": 0, "errors": 0}
        processed = 0

        for i in range(0, len(posts), batch_size):
            batch = posts[i:i + batch_size]
            counts = classify_batch(batch)
            for k in totals:
                totals[k] += counts[k]
            processed += len(batch)

            log.info(
                f"Progress: {processed}/{total} | "
                f"IDV: {totals['idv']} | Not IDV: {totals['not_idv']} | "
                f"Errors: {totals['errors']}"
            )

        finish_run(run_id, processed, processed - totals["errors"], totals["errors"])
        _print_summary(totals, total)
        return totals

    else:
        total = get_unrefiltered_count()
        log.info(f"Starting FULL IDV classification. {total} posts to process ({LLM_CONCURRENCY} workers)")

        if total == 0:
            log.info("No posts to classify.")
            return

        run_id = start_run("pass1_idv", "full", {
            "model": "deepseek-v3.2", "total": total,
            "concurrency": LLM_CONCURRENCY,
        })

        totals = {"idv": 0, "not_idv": 0, "errors": 0}
        processed = 0
        batch_size = LLM_CONCURRENCY * 2

        while True:
            batch = get_unrefiltered_posts(batch_size=batch_size)
            if not batch:
                break

            counts = classify_batch(batch)
            for k in totals:
                totals[k] += counts[k]
            processed += len(batch)

            remaining = get_unrefiltered_count()
            log.info(
                f"Progress: {processed}/{total} | "
                f"IDV: {totals['idv']} | Not IDV: {totals['not_idv']} | "
                f"Errors: {totals['errors']} | Remaining: {remaining}"
            )

        finish_run(run_id, processed, processed - totals["errors"], totals["errors"])
        _print_summary(totals, total)
        return totals


def _print_summary(totals: dict, total: int):
    log.info("=" * 60)
    log.info("IDV PASS 1 CLASSIFICATION COMPLETE")
    log.info(f"  Total processed:  {total}")
    log.info(f"  IDV relevant:     {totals['idv']} ({totals['idv']/total*100:.1f}%)")
    log.info(f"  Not IDV:          {totals['not_idv']} ({totals['not_idv']/total*100:.1f}%)")
    log.info(f"  Errors:           {totals['errors']}")
    log.info("=" * 60)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "sample":
        size = int(sys.argv[2]) if len(sys.argv) > 2 else 50
        run_classifier(sample_size=size)
    else:
        run_classifier()
