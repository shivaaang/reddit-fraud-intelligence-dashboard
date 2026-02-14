"""Pass 2 deep classification via DeepSeek V3.2 API (through OpenRouter).

Usage:
    python -m backend.pass2_classifier test-fraud 5      # Test batch of 5 fraud posts
    python -m backend.pass2_classifier test-idv 5        # Test batch of 5 IDV posts
    python -m backend.pass2_classifier run-fraud 20      # Classify fraud posts (20 concurrent workers)
    python -m backend.pass2_classifier run-idv 20        # Classify IDV posts (20 concurrent workers)
    python -m backend.pass2_classifier progress           # Check progress
"""

import sys
import time
from typing import Literal, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from pydantic import BaseModel, Field, ConfigDict, ValidationError

from backend.llm_client import call_deepseek
from backend.db import (
    get_top_comments_for_post,
    insert_fraud_classification, insert_idv_classification,
    get_ready_unclassified_posts, get_classification_progress,
)

# ============================================================
# Configuration
# ============================================================

MAX_RETRIES = 3

# ============================================================
# Pydantic Validation Models
# ============================================================

class FraudClassification(BaseModel):
    """Strict validation for fraud classification output."""
    model_config = ConfigDict(extra="forbid")

    is_relevant: bool
    fraud_type: Literal[
        "identity_theft", "account_takeover", "phishing", "romance_scam",
        "investment_scam", "employment_scam", "payment_fraud",
        "deepfake_ai", "sim_swap", "data_breach",
        "business_impersonation", "document_forgery", "other",
    ]
    industry: Literal[
        "banking", "fintech", "crypto", "ecommerce", "social_media",
        "gig_economy", "government", "telecom", "healthcare",
        "real_estate", "gaming", "dating", "other",
    ]
    loss_bracket: Literal[
        "none", "under_100", "100_to_1k", "1k_to_10k",
        "10k_to_100k", "over_100k", "unspecified",
    ]
    channel: Literal[
        "email", "phone", "sms", "messaging_app", "social_media",
        "website", "in_person", "app", "mail", "other",
    ]
    notable_quote: Optional[str] = None
    tags: list[str] = Field(min_length=2, max_length=5)


class IDVClassification(BaseModel):
    """Strict validation for IDV classification output."""
    model_config = ConfigDict(extra="forbid")

    is_relevant: bool
    verification_type: Literal[
        "document_upload", "selfie_photo", "facial_age_estimation",
        "liveness_check", "knowledge_based", "database_lookup",
        "phone_verification", "other", "unknown",
    ]
    friction_type: Literal[
        "technical_failure", "false_rejection", "too_slow", "too_many_steps",
        "excessive_reverification", "privacy_concern", "accessibility_issue",
        "info_mismatch", "no_alternative_method", "country_restriction",
        "none", "other",
    ]
    trigger_reason: Literal[
        "new_account", "age_gate", "account_recovery", "periodic_recheck",
        "suspicious_activity", "transaction", "policy_change",
        "document_update", "new_device_location", "unknown",
    ]
    platform_name: Optional[str] = None
    sentiment: Literal["positive", "negative", "neutral", "mixed"]
    notable_quote: Optional[str] = None
    tags: list[str] = Field(min_length=2, max_length=5)


# ============================================================
# System Prompts
# ============================================================

FRAUD_SYSTEM_PROMPT = """You are a fraud intelligence analyst extracting structured data from a Reddit post and its comments.

Classify the post into the fields below. Use enum values exactly as listed. Respond with ONLY a valid JSON object.

is_relevant — Set to true if this post describes an actual fraud incident, victim experience, scam warning, or fraud news story. Set to false if the post is NOT actually about fraud — for example, product announcements, general security advice, technology demos, policy discussions, or posts that only mention fraud tangentially. When is_relevant is false, still fill in all other fields to the best of your ability.

fraud_type — The primary type of fraud described:
  identity_theft: Someone's personal information (SSN, DOB, name) stolen or used without consent to open accounts, file taxes, or take loans. Includes familial fraud (parent/ex using victim's identity).
  account_takeover: Existing online account hijacked through stolen credentials, session hijacking, or unauthorized access.
  phishing: Deceptive emails, texts, or messages with fake links designed to steal login credentials or personal information.
  romance_scam: Fake romantic relationship built over time to extract money through emotional manipulation. Includes catfishing for money.
  investment_scam: Fraudulent investment opportunities — crypto schemes, Ponzi schemes, pig butchering, fake trading platforms, MLM scams.
  employment_scam: Fake job offers designed to steal personal information, extract upfront payments, or harvest identities from applicants.
  payment_fraud: Unauthorized transactions, stolen credit/debit cards, fake checks, shopping scams, chargebacks, or refund abuse.
  deepfake_ai: AI-generated images, video, or voice used to impersonate real people or create fake evidence for fraud.
  sim_swap: Phone number ported to a new SIM card without the owner's authorization, enabling account takeovers.
  data_breach: Personal data exposed through a security breach at a company or organization.
  business_impersonation: Pretending to be a legitimate company, government agency, or tech support to extract money or information. Includes tech support scams and IRS/SSA impersonation.
  document_forgery: Creation or use of fake IDs, passports, diplomas, certificates, or other official documents.
  other: Fraud that doesn't fit any category above.

industry — The industry or platform where the fraud occurred:
  banking: Traditional banks and credit unions (Chase, Bank of America, Wells Fargo).
  fintech: Payment apps and neobanks (PayPal, Venmo, CashApp, Zelle, Wise, Revolut, Klarna).
  crypto: Cryptocurrency exchanges and platforms (Coinbase, Binance, Kraken, DeFi).
  ecommerce: Online shopping (Amazon, eBay, Facebook Marketplace, Etsy, Craigslist).
  social_media: Social networking platforms (Facebook, Instagram, Twitter/X, TikTok, Reddit).
  gig_economy: Ride-share, delivery, and freelance platforms (Uber, Lyft, DoorDash, Instacart, Upwork).
  government: Government services and agencies (IRS, SSA, DMV, unemployment).
  telecom: Phone carriers and ISPs (AT&T, Verizon, T-Mobile).
  healthcare: Hospitals, insurance companies, pharmacies, medical billing.
  real_estate: Property, rental, and housing (apartment listings, mortgage, landlords).
  gaming: Video games and online gambling/poker platforms.
  dating: Dating apps and websites (Tinder, Bumble, Hinge, Match).
  other: Industry not listed above or not identifiable from the post.

loss_bracket — The financial loss described:
  none: Victim explicitly stated they lost no money (caught the scam in time or got a full refund).
  under_100: Loss under $100.
  100_to_1k: Loss between $100 and $1,000.
  1k_to_10k: Loss between $1,000 and $10,000.
  10k_to_100k: Loss between $10,000 and $100,000.
  over_100k: Loss over $100,000.
  unspecified: The post does not mention a specific dollar amount.

channel — How the fraud was delivered to the victim:
  email: Via email messages.
  phone: Via voice phone calls.
  sms: Via text messages (SMS).
  messaging_app: Via messaging platforms (WhatsApp, Telegram, Signal, Discord, WeChat, iMessage).
  social_media: Via social media platforms (Facebook, Instagram, Twitter/X, TikTok DMs or posts).
  website: Via a website or web page (fake sites, phishing pages, fraudulent online stores).
  app: Via a mobile application.
  in_person: Face-to-face interaction.
  mail: Via physical postal mail.
  other: Channel not listed above or unclear from the post.

notable_quote: The most compelling 1-2 sentence verbatim quote from the post or its comments. Prefer the original poster's own words. Use null if the post is too short or lacks a striking quote.

tags: 2-5 freeform descriptive tags capturing themes not fully covered by the fields above (e.g., pig_butchering, elderly_victim, familial, repeat_victim, law_enforcement, cross_border, crypto_recovery_scam).

Comments marked (OP) are from the original poster and often contain critical details about amounts lost, companies involved, or resolution status."""

IDV_SYSTEM_PROMPT = """You are an identity verification analyst extracting structured data from a Reddit post and its comments.

Classify the post into the fields below. Use enum values exactly as listed. When a post involves multiple verification methods or friction types, choose the one the user focuses on most. When uncertain, prefer "other" or "unknown" over guessing a specific value. Respond with ONLY a valid JSON object.

is_relevant — Set to true if this post substantively discusses an identity verification experience, friction, process, or policy. Set to false if the post is NOT actually about identity verification — for example, referral or signup spam that mentions KYC only as a mechanical step, 2FA/MFA login code issues (not identity verification), fiction or satire, posts that mention verification only tangentially, or posts about country-specific government identity infrastructure (Aadhaar-PAN linking, EPFO portal, passport police verification) that are about local bureaucracy rather than platform or digital identity verification. Posts from users in any country complaining about global platforms (Coinbase, Uber, YouTube) ARE relevant. When is_relevant is false, still fill in all other fields to the best of your ability.

verification_type — The primary identity verification method discussed:
  document_upload: User photographs or uploads an identity document (driver's license, passport, national ID). Includes live photo of ID or uploading a scan.
  selfie_photo: User takes a selfie matched against their ID photo (face match). Common on gig apps and crypto exchanges.
  facial_age_estimation: AI estimates user's age from their face WITHOUT identifying them. Used for age gates on YouTube, Roblox, Discord, Instagram.
  liveness_check: User performs actions on camera to prove they are real — turn head, blink, smile, record a short video. Proves liveness, not a photo or deepfake.
  knowledge_based: User answers security questions or provides information only they should know. Credit bureau questions, IRS identity verification questions, "What street did you grow up on?"
  database_lookup: Platform cross-references user info (name, SSN, DOB) against government or credit bureau databases. Often invisible to the user.
  phone_verification: Phone number used to verify identity — NOT 2FA/MFA login codes. When a platform requires a phone number as proof of who you are.
  other: Method not clearly described or not listed above. Includes in-person verification, credit card age checks, address verification via mail.

friction_type — The primary pain point or complaint about the verification process:
  technical_failure: System errors, app crashes, camera malfunctions, upload failures, or server issues during verification.
  false_rejection: Legitimate user's valid ID or selfie is incorrectly rejected. The user is real but the system says no. Includes appearance changes (weight, surgery, hair, aging) causing face match failure.
  too_slow: Verification takes too long — days or weeks to get approved, pending review with no timeline.
  too_many_steps: Single verification flow has too many steps — multiple document uploads, repeated selfie attempts, excessive form fields in one session.
  excessive_reverification: User already verified successfully but the platform keeps asking them to verify again — daily, weekly, or after short intervals. Distinct from too_many_steps (which is about one flow being complex). Common on gig platforms and social media.
  privacy_concern: User is uncomfortable sharing personal data, face photos, or government ID with the platform. Concerns about biometric data collection, breaches, or surveillance.
  accessibility_issue: Barriers due to disability, old age, low technical literacy, lack of required technology, or lack of identity documents entirely.
  info_mismatch: User's current information doesn't match what's on file or on their document — name change, expired document, address difference, gender marker update, abbreviation vs full name.
  no_alternative_method: The only verification path fails and the platform offers no fallback — no manual review, no support escalation, no other ID accepted. Includes being locked out with no resolution path.
  country_restriction: User's identity document from their country is not accepted by the platform.
  none: Post discusses identity verification without expressing friction — news articles, positive reviews, general discussion, vendor evaluations.
  other: Friction not listed above.

trigger_reason — What triggered the identity verification request:
  new_account: First-time signup, onboarding KYC, initial identity verification during registration.
  age_gate: Platform requires proof of age to access content or features, driven by legislation or platform policy.
  account_recovery: User is trying to regain access to a locked, hacked, disabled, or suspended account.
  periodic_recheck: Platform requests re-verification with no clear reason — "out of nowhere," routine re-check.
  suspicious_activity: Platform's automated system flagged the account for unusual behavior or risk signals.
  transaction: Triggered by a withdrawal, large purchase, cashout, or financial activity.
  policy_change: Platform recently introduced or changed verification requirements.
  document_update: User's ID expired, they got a new license or passport, or personal info needs updating.
  new_device_location: Login from an unfamiliar device, IP address, or country triggered verification.
  unknown: Trigger reason not described or not identifiable from the post.

platform_name: The specific company or platform where verification is happening (e.g., "Uber", "Coinbase", "Roblox", "Facebook", "ID.me"). If multiple platforms are mentioned, use the one the user is primarily discussing. Use null if no specific platform is mentioned.

sentiment — The overall tone of the post toward the verification experience:
  positive: User had a good experience or supports the verification process.
  negative: User is frustrated, angry, or had a bad experience.
  neutral: Factual discussion without strong emotion.
  mixed: Post contains both positive and negative sentiments.

notable_quote: The most compelling 1-2 sentence verbatim quote from the post or its comments. Prefer the original poster's own words. Use null if the post is too short or lacks a striking quote.

tags: 2-5 freeform descriptive tags capturing contextual details not covered by the structured fields — such as the user's situation (gig_worker, elderly_user, expat, transgender), specific vendor or SDK (persona, jumio, yoti), regulatory context (uk_osa, australia_ban), or resolution outcome (account_restored, permanently_banned). Do not restate the structured field values as tags.

Comments marked (OP) are from the original poster and often contain additional details about the verification experience, workarounds tried, or resolution status."""


# ============================================================
# Response Pre-processing & Validation
# ============================================================

def _preprocess(data: dict) -> dict:
    """Normalize common LLM quirks before Pydantic validation."""
    # Normalize boolean fields
    if "is_relevant" in data and isinstance(data["is_relevant"], str):
        data["is_relevant"] = data["is_relevant"].strip().lower() in ("true", "yes", "1")

    for key in ("notable_quote", "platform_name"):
        if key in data and isinstance(data[key], str):
            val = data[key].strip()
            if val.lower() in ("null", "none", "n/a", "na", ""):
                data[key] = None

    # Normalize enum values to lowercase with underscores
    enum_fields = [
        "fraud_type", "industry", "loss_bracket", "channel",
        "verification_type", "friction_type", "sentiment",
    ]
    for field in enum_fields:
        if field in data and isinstance(data[field], str):
            data[field] = data[field].strip().lower().replace(" ", "_").replace("-", "_")

    # Fix common LLM enum mismatches
    if data.get("friction_type") == "unknown":
        data["friction_type"] = "other"
    if data.get("trigger_reason") == "info_mismatch":
        data["trigger_reason"] = "unknown"

    # Ensure tags is a list
    if "tags" in data:
        if isinstance(data["tags"], str):
            data["tags"] = [t.strip() for t in data["tags"].split(",") if t.strip()]
        elif isinstance(data["tags"], list):
            data["tags"] = [str(t).strip().lower().replace(" ", "_") for t in data["tags"] if t]

    return data


# ============================================================
# Post Formatting
# ============================================================

def _format_user_prompt(post: dict) -> str:
    """Format a post + comments into the user prompt."""
    comments = get_top_comments_for_post(post["post_id"], limit=5)

    body = (post["selftext"] or "")[:3000]

    comments_text = ""
    if comments:
        parts = []
        for i, c in enumerate(comments, 1):
            op_tag = " (OP)" if c["is_submitter"] else ""
            author = c["author"] or "[deleted]"
            parts.append(
                f"[Comment {i} | Score: {c['score']} | By: {author}{op_tag}]\n"
                f"{c['body'][:500]}"
            )
        comments_text = "\n\n".join(parts)
    else:
        comments_text = "(No comments available)"

    return (
        f"Classify this Reddit post:\n\n"
        f"Subreddit: r/{post['subreddit']}\n"
        f"Title: {post['title']}\n"
        f"Body: {body}\n\n"
        f"Top Comments:\n{comments_text}\n\n"
        f"Score: {post['score']} | Comments: {post['num_comments']}"
    )


# ============================================================
# Classification Pipeline
# ============================================================

def classify_fraud_post(post: dict, reasoning: str = None) -> dict | None:
    """Classify a single fraud post. Returns validated dict or None."""
    user_prompt = _format_user_prompt(post)

    for attempt in range(1, MAX_RETRIES + 1):
        raw = call_deepseek(FRAUD_SYSTEM_PROMPT, user_prompt, reasoning=reasoning)
        if raw is None:
            continue

        processed = _preprocess(raw)

        try:
            validated = FraudClassification(**processed)
            return validated.model_dump()
        except ValidationError as e:
            errors = e.errors()
            print(f"  [VALIDATION] Post {post['post_id']} attempt {attempt}:")
            for err in errors:
                print(f"    - {err['loc']}: {err['msg']} (got: {err.get('input', '?')})")
            if attempt < MAX_RETRIES:
                continue
            return None

    return None


def classify_idv_post(post: dict, reasoning: str = None) -> dict | None:
    """Classify a single IDV post. Returns validated dict or None."""
    user_prompt = _format_user_prompt(post)

    for attempt in range(1, MAX_RETRIES + 1):
        raw = call_deepseek(IDV_SYSTEM_PROMPT, user_prompt, reasoning=reasoning)
        if raw is None:
            continue

        processed = _preprocess(raw)

        try:
            validated = IDVClassification(**processed)
            return validated.model_dump()
        except ValidationError as e:
            errors = e.errors()
            print(f"  [VALIDATION] Post {post['post_id']} attempt {attempt}:")
            for err in errors:
                print(f"    - {err['loc']}: {err['msg']} (got: {err.get('input', '?')})")
            if attempt < MAX_RETRIES:
                continue
            return None

    return None


# ============================================================
# Batch Processing
# ============================================================

def _process_fraud_worker(post: dict, reasoning: str = None) -> tuple[str, bool]:
    """Worker function for concurrent fraud classification."""
    post_id = post["post_id"]
    result = classify_fraud_post(post, reasoning=reasoning)
    if result:
        insert_fraud_classification(post_id, result, model="deepseek-v3.2")
        return (post_id, True)
    else:
        print(f"  [FAIL] Fraud post {post_id} failed after all retries")
        return (post_id, False)


def _process_idv_worker(post: dict, reasoning: str = None) -> tuple[str, bool]:
    """Worker function for concurrent IDV classification."""
    post_id = post["post_id"]
    result = classify_idv_post(post, reasoning=reasoning)
    if result:
        insert_idv_classification(post_id, result, model="deepseek-v3.2")
        return (post_id, True)
    else:
        print(f"  [FAIL] IDV post {post_id} failed after all retries")
        return (post_id, False)


def run_batch(track: str, workers: int = 20, batch_size: int = 200, reasoning: str = None):
    """Run classification on unclassified posts with concurrent workers."""
    posts = get_ready_unclassified_posts(track, batch_size)

    if not posts:
        print("No posts to classify.")
        return 0, 0

    print(f"Classifying {len(posts)} {track} posts with {workers} workers...")

    success = 0
    failed = 0
    start = time.time()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        if track == "fraud":
            futures = {executor.submit(_process_fraud_worker, post, reasoning): post for post in posts}
        else:
            futures = {executor.submit(_process_idv_worker, post, reasoning): post for post in posts}

        for i, future in enumerate(as_completed(futures), 1):
            post_id, ok = future.result()
            if ok:
                success += 1
            else:
                failed += 1

            if i % 10 == 0 or i == len(posts):
                elapsed = time.time() - start
                rate = i / elapsed * 3600 if elapsed > 0 else 0
                print(f"  [{i}/{len(posts)}] {success} ok, {failed} fail | "
                      f"{elapsed:.0f}s elapsed | {rate:.0f} posts/hr")

    elapsed = time.time() - start
    print(f"\nDone: {success} classified, {failed} failed in {elapsed:.1f}s")
    return success, failed


def run_continuous(track: str, workers: int = 20, reasoning: str = None):
    """Run classification continuously, processing all available posts.

    Keeps looping until no more posts are available, then waits 5 min
    for the comment collector to make more posts ready. Exits after
    4 consecutive empty checks (20 min).
    """
    total_success = 0
    total_failed = 0
    wave = 0
    empty_checks = 0
    run_start = time.time()

    while empty_checks < 4:
        posts = get_ready_unclassified_posts(track, batch_size=500)

        if not posts:
            empty_checks += 1
            elapsed_total = time.time() - run_start
            print(f"\n[{elapsed_total/60:.0f}m] No posts available (check {empty_checks}/4). "
                  f"Total so far: {total_success} ok, {total_failed} fail.")
            if empty_checks < 4:
                print("Waiting 5 minutes for comment collector...")
                time.sleep(300)
            continue

        empty_checks = 0  # reset on successful fetch
        wave += 1
        elapsed_total = time.time() - run_start
        print(f"\n{'='*60}")
        print(f"Wave {wave} | {len(posts)} posts | {elapsed_total/60:.0f}m elapsed | "
              f"Running total: {total_success} ok, {total_failed} fail")
        print(f"{'='*60}")

        success = 0
        failed = 0
        start = time.time()

        with ThreadPoolExecutor(max_workers=workers) as executor:
            if track == "fraud":
                futures = {executor.submit(_process_fraud_worker, post, reasoning): post for post in posts}
            else:
                futures = {executor.submit(_process_idv_worker, post, reasoning): post for post in posts}

            for i, future in enumerate(as_completed(futures), 1):
                post_id, ok = future.result()
                if ok:
                    success += 1
                else:
                    failed += 1

                if i % 20 == 0 or i == len(posts):
                    elapsed = time.time() - start
                    rate = i / elapsed * 3600 if elapsed > 0 else 0
                    print(f"  [{i}/{len(posts)}] {success} ok, {failed} fail | "
                          f"{elapsed:.0f}s elapsed | {rate:.0f} posts/hr")

        total_success += success
        total_failed += failed

    total_elapsed = time.time() - run_start
    print(f"\n{'='*60}")
    print(f"FINISHED: {total_success} classified, {total_failed} failed")
    print(f"Total time: {total_elapsed/3600:.1f} hours")
    print(f"{'='*60}")


# ============================================================
# Test Mode
# ============================================================

def test_batch(track: str, count: int = 5, reasoning: str = None):
    """Run a test batch and print detailed results (no concurrency)."""
    posts = get_ready_unclassified_posts(track, batch_size=count, random_order=True)

    print(f"=== TEST: {count} {track} posts ===\n")

    classify_fn = classify_fraud_post if track == "fraud" else classify_idv_post
    success = 0
    failed = 0

    for i, post in enumerate(posts, 1):
        print(f"[{i}/{count}] Post: {post['post_id']} | r/{post['subreddit']}")
        print(f"  Title: {post['title'][:80]}")

        start = time.time()
        result = classify_fn(post, reasoning=reasoning)
        elapsed = time.time() - start

        if result:
            success += 1
            print(f"  VALID ({elapsed:.1f}s)")
            for k, v in result.items():
                print(f"    {k}: {v}")
        else:
            failed += 1
            print(f"  FAILED after {MAX_RETRIES} retries ({elapsed:.1f}s)")
        print()

    print(f"=== Results: {success}/{count} valid, {failed}/{count} failed ===")


# ============================================================
# CLI
# ============================================================

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "progress"

    if cmd == "test-fraud":
        count = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        test_batch("fraud", count, reasoning="low")
    elif cmd == "test-idv":
        count = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        test_batch("idv", count, reasoning="low")
    elif cmd == "run-fraud":
        workers = int(sys.argv[2]) if len(sys.argv) > 2 else 20
        run_continuous("fraud", workers, reasoning="low")
    elif cmd == "run-idv":
        workers = int(sys.argv[2]) if len(sys.argv) > 2 else 20
        run_continuous("idv", workers, reasoning=None)
    elif cmd == "progress":
        p = get_classification_progress()
        print(f"Fraud: {p['fraud_done']} done, {p['fraud_ready']} ready")
        print(f"IDV:   {p['idv_done']} done, {p['idv_ready']} ready")
    else:
        print(f"Unknown command: {cmd}")
        print("Commands: test-fraud, test-idv, run-fraud, run-idv, progress")
        sys.exit(1)
