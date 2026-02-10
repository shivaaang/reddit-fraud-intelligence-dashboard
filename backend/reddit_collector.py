"""Phase 1: Collect Reddit posts using the public .json endpoint (no API key needed)."""

import time
import urllib.parse
from datetime import datetime, timezone
import httpx
from backend.config import REDDIT_BASE_URL, REDDIT_USER_AGENT, REDDIT_REQUEST_DELAY
from backend.db import insert_posts_batch, start_run, finish_run
from backend.utils import setup_logger

log = setup_logger("reddit_collector")

# Shared HTTP client
_client = None


def _get_client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            headers={"User-Agent": REDDIT_USER_AGENT},
            timeout=30.0,
            follow_redirects=True,
        )
    return _client


def _reddit_get(url: str, params: dict = None) -> dict | None:
    """Make a rate-limited GET request to Reddit's .json endpoint."""
    client = _get_client()
    try:
        resp = client.get(url, params=params)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "60"))
            log.warning(f"Rate limited (429). Waiting {retry_after}s...")
            time.sleep(retry_after)
            resp = client.get(url, params=params)

        if resp.status_code != 200:
            log.error(f"HTTP {resp.status_code} for {url}: {resp.text[:200]}")
            return None

        return resp.json()
    except Exception as e:
        log.error(f"Request failed for {url}: {e}")
        return None


def _extract_posts_from_listing(data: dict, source: str,
                                search_query: str = None) -> list[dict]:
    """Extract post dicts from a Reddit listing JSON response."""
    if not data or "data" not in data:
        return []

    posts = []
    for child in data["data"].get("children", []):
        if child.get("kind") != "t3":
            continue
        d = child["data"]
        posts.append({
            "post_id": d["id"],
            "post_fullname": d["name"],
            "title": d.get("title", ""),
            "selftext": d.get("selftext", ""),
            "url": d.get("url", ""),
            "subreddit": d.get("subreddit", ""),
            "author": d.get("author") if d.get("author") != "[deleted]" else None,
            "score": d.get("score", 0),
            "upvote_ratio": d.get("upvote_ratio"),
            "num_comments": d.get("num_comments", 0),
            "created_utc": datetime.fromtimestamp(d.get("created_utc", 0), tz=timezone.utc),
            "permalink": d.get("permalink", ""),
            "is_self": d.get("is_self", False),
            "over_18": d.get("over_18", False),
            "link_flair_text": d.get("link_flair_text"),
            "stickied": d.get("stickied", False),
            "locked": d.get("locked", False),
            "collection_source": source,
            "search_query": search_query,
        })
    return posts


def _get_after_cursor(data: dict) -> str | None:
    """Get the pagination cursor from a listing response."""
    if data and "data" in data:
        return data["data"].get("after")
    return None


def _paginated_fetch(url: str, params: dict, source: str,
                     search_query: str = None, max_pages: int = 10) -> list[dict]:
    """Fetch multiple pages from a Reddit listing endpoint."""
    all_posts = []
    after = None

    for page in range(max_pages):
        req_params = {**params}
        if after:
            req_params["after"] = after

        data = _reddit_get(url, params=req_params)
        if data is None:
            break

        posts = _extract_posts_from_listing(data, source, search_query)
        if not posts:
            break

        all_posts.extend(posts)
        after = _get_after_cursor(data)

        if after is None:
            break  # No more pages

        time.sleep(REDDIT_REQUEST_DELAY)

    return all_posts


# ── Collection Tiers ──────────────────────────────────────────────────────

# Tier 1: High-density fraud subreddits (direct listings)
TIER1_SUBREDDITS = {
    "Scams": ["top/year", "top/all", "new", "hot", "controversial/year"],
    "identitytheft": ["top/all", "new", "hot"],
    "fraud": ["top/all", "new", "hot"],
}

# Tier 2: Medium-density subreddits (keyword search within)
TIER2_SEARCHES = {
    "personalfinance": [
        "fraud", "identity theft", "scammed", "stolen identity",
        "unauthorized charges", "someone opened account",
        "credit card stolen", "phishing email",
    ],
    "CryptoCurrency": [
        "scam", "KYC", "hacked wallet", "phishing",
        "rug pull", "fake exchange", "identity verification",
    ],
    "CreditCards": [
        "fraud", "stolen card", "unauthorized transaction",
        "skimmed", "identity theft",
    ],
    "banking": [
        "fraud", "account hacked", "unauthorized",
        "identity theft", "scam",
    ],
    "cybersecurity": [
        "identity fraud", "deepfake", "phishing campaign",
        "credential theft", "social engineering attack",
    ],
}

# Tier 3: Cross-Reddit keyword searches (r/all)
GLOBAL_SEARCH_QUERIES = [
    "identity stolen what do I do",
    "someone opened account my name",
    "identity theft report",
    "my identity was stolen",
    "deepfake scam",
    "deepfake fraud",
    "AI generated fake identity",
    "synthetic identity fraud",
    "identity verification experience",
    "identity verification selfie",
    "KYC nightmare",
    "KYC experience",
    "liveness check",
    "selfie verification",
    "document verification failed",
    "age verification online",
    "account takeover bank",
    "SIM swap attack",
    "phishing stolen credentials",
    "fake ID caught",
    "business email compromise",
    "romance scam money",
    "verification bypass",
    "fake ID online order",
    "biometric spoofing",
    "liveness detection bypass",
    "face swap verification",
    "identity verification frustrating",
    "Persona verification",
    "Instacart verification",
    "Uber driver verification",
    "Lyft identity check",
    "Coinbase KYC",
]


def collect_tier1():
    """Tier 1: Pull direct listings from high-density fraud subreddits."""
    run_id = start_run("initial_collection", "tier1_listings",
                       {"subreddits": list(TIER1_SUBREDDITS.keys())})
    total_inserted = 0
    total_fetched = 0
    failed = 0

    for sub_name, listings in TIER1_SUBREDDITS.items():
        for listing_type in listings:
            parts = listing_type.split("/")
            sort = parts[0]
            time_filter = parts[1] if len(parts) > 1 else None

            url = f"{REDDIT_BASE_URL}/r/{sub_name}/{sort}.json"
            params = {"limit": 100}
            if time_filter:
                params["t"] = time_filter

            source = f"listing_{listing_type.replace('/', '_')}"
            log.info(f"Collecting r/{sub_name} — {listing_type}...")

            try:
                posts = _paginated_fetch(url, params, source, max_pages=10)
                total_fetched += len(posts)
                if posts:
                    inserted = insert_posts_batch(posts)
                    total_inserted += inserted
                    log.info(f"  r/{sub_name}/{listing_type}: {len(posts)} fetched, {inserted} new")
                else:
                    log.info(f"  r/{sub_name}/{listing_type}: 0 posts returned")
            except Exception as e:
                log.error(f"Error on r/{sub_name}/{listing_type}: {e}")
                failed += 1

            time.sleep(REDDIT_REQUEST_DELAY)

    finish_run(run_id, total_fetched, total_inserted, failed)
    log.info(f"Tier 1 complete: {total_fetched} fetched, {total_inserted} new inserts")
    return total_inserted


def collect_tier2():
    """Tier 2: Keyword searches within medium-density subreddits."""
    run_id = start_run("initial_collection", "tier2_search",
                       {"subreddits": list(TIER2_SEARCHES.keys())})
    total_inserted = 0
    total_fetched = 0
    failed = 0

    for sub_name, queries in TIER2_SEARCHES.items():
        for query in queries:
            for sort in ["relevance", "top"]:
                url = f"{REDDIT_BASE_URL}/r/{sub_name}/search.json"
                params = {
                    "q": query,
                    "restrict_sr": "on",
                    "sort": sort,
                    "t": "year",
                    "limit": 100,
                }
                source = f"search_subreddit_{sort}"

                log.info(f"Searching r/{sub_name} for '{query}' (sort={sort})...")

                try:
                    posts = _paginated_fetch(url, params, source,
                                             search_query=query, max_pages=10)
                    total_fetched += len(posts)
                    if posts:
                        inserted = insert_posts_batch(posts)
                        total_inserted += inserted
                except Exception as e:
                    log.error(f"Error searching r/{sub_name} for '{query}': {e}")
                    failed += 1

                time.sleep(REDDIT_REQUEST_DELAY)

        log.info(f"  r/{sub_name} done. Running: {total_fetched} fetched, {total_inserted} inserted")

    finish_run(run_id, total_fetched, total_inserted, failed)
    log.info(f"Tier 2 complete: {total_fetched} fetched, {total_inserted} new inserts")
    return total_inserted


def collect_tier3():
    """Tier 3: Global keyword searches across all of Reddit."""
    run_id = start_run("initial_collection", "tier3_global",
                       {"query_count": len(GLOBAL_SEARCH_QUERIES)})
    total_inserted = 0
    total_fetched = 0
    failed = 0

    for query in GLOBAL_SEARCH_QUERIES:
        url = f"{REDDIT_BASE_URL}/search.json"
        params = {
            "q": query,
            "sort": "relevance",
            "t": "year",
            "limit": 100,
        }

        log.info(f"Global search: '{query}'...")

        try:
            posts = _paginated_fetch(url, params, "search_global",
                                     search_query=query, max_pages=10)
            total_fetched += len(posts)
            if posts:
                inserted = insert_posts_batch(posts)
                total_inserted += inserted
                log.info(f"  '{query}': {len(posts)} fetched, {inserted} new")
        except Exception as e:
            log.error(f"Error in global search for '{query}': {e}")
            failed += 1

        time.sleep(REDDIT_REQUEST_DELAY)

    finish_run(run_id, total_fetched, total_inserted, failed)
    log.info(f"Tier 3 complete: {total_fetched} fetched, {total_inserted} new inserts")
    return total_inserted


# Tier 4: Persona competitor and IDV company searches
TIER4_COMPETITOR_QUERIES = [
    "Jumio verification",
    "Jumio identity",
    "Onfido verification",
    "Onfido identity check",
    "Sumsub verification",
    "Sumsub KYC",
    "Veriff identity verification",
    "Veriff KYC",
    "ID.me verification",
    "ID.me problems",
    "ID.me identity",
    "Plaid identity verification",
    "Mitek verification",
    "Socure identity",
    "iProov liveness",
    "Entrust identity verification",
    "Au10tix verification",
    "Trulioo identity",
    "Shufti Pro verification",
    "Clear identity verification",
    "CLEAR verified",
]

# Tier 5: Deep KYC/AML/IDV experience searches
TIER5_KYC_QUERIES = [
    "KYC failed my account",
    "identity verification keeps failing",
    "can't verify my identity",
    "ID verification frustrating",
    "selfie verification not working",
    "document rejected verification",
    "why do I need to verify my identity",
    "identity verification privacy concern",
    "AML check blocked my account",
    "enhanced due diligence",
    "facial recognition verification",
    "bank froze account verification",
    "crypto exchange identity verification",
    "gig app identity check",
    "age verification unfair",
    "biometric data privacy concern",
    "identity verification accessibility",
    "disabled identity verification",
    "identity verification took too long",
    "KYC verification rejected",
    "verify identity drivers license",
    "identity verification passport",
    "verification selfie failed",
    "account locked identity verification",
    "identity verification data breach",
    "why does this app need my ID",
    "forced to upload ID",
    "identity verification scam or legit",
    "onboarding identity check",
    "remote identity verification",
]


def _collect_global_queries(queries: list[str], tier_name: str, source_tag: str):
    """Generic global search collector for any list of queries."""
    run_id = start_run("initial_collection", tier_name,
                       {"query_count": len(queries)})
    total_inserted = 0
    total_fetched = 0
    failed = 0

    for query in queries:
        url = f"{REDDIT_BASE_URL}/search.json"
        params = {
            "q": query,
            "sort": "relevance",
            "t": "year",
            "limit": 100,
        }

        log.info(f"[{tier_name}] Global search: '{query}'...")

        try:
            posts = _paginated_fetch(url, params, source_tag,
                                     search_query=query, max_pages=10)
            total_fetched += len(posts)
            if posts:
                inserted = insert_posts_batch(posts)
                total_inserted += inserted
                log.info(f"  '{query}': {len(posts)} fetched, {inserted} new")
        except Exception as e:
            log.error(f"Error in global search for '{query}': {e}")
            failed += 1

        time.sleep(REDDIT_REQUEST_DELAY)

    finish_run(run_id, total_fetched, total_inserted, failed)
    log.info(f"{tier_name} complete: {total_fetched} fetched, {total_inserted} new inserts")
    return total_inserted


# Tier 6: Persona client companies
TIER6_PERSONA_CLIENT_QUERIES = [
    "OpenAI verify identity",
    "ChatGPT age verification",
    "ChatGPT verify age",
    "DoorDash ID verification",
    "DoorDash dasher verify",
    "Cash App verify identity",
    "Cash App KYC",
    "Carvana verify identity",
    "Carvana ID verification",
    "Coursera verify identity",
    "Coursera identity verification",
    "Square verify identity",
    "Robinhood verify identity",
    "Robinhood identity verification",
    "Revolut verify identity",
    "Revolut KYC failed",
    "Wise verify identity",
    "Kraken verify identity",
    "Kraken KYC",
    "Crypto.com verify identity",
]

# Tier 7: Social media & consumer platform verification
TIER7_SOCIAL_PLATFORM_QUERIES = [
    "Facebook verify identity",
    "Facebook selfie verification",
    "Facebook video verification",
    "Instagram verify identity",
    "Instagram selfie verification",
    "LinkedIn verify identity",
    "LinkedIn ID verification",
    "Twitter verify identity",
    "Discord verify identity",
    "Discord age verification",
    "TikTok verify identity",
    "TikTok age verification",
    "Snapchat verify identity",
    "YouTube age verification",
    "Airbnb verify identity",
    "Airbnb ID verification",
    "Amazon verify identity",
    "eBay verify identity",
    "Apple ID verification",
    "Reddit verify identity",
]

# Tier 8: Fintech & gig economy verification
TIER8_FINTECH_GIG_QUERIES = [
    "PayPal verify identity",
    "PayPal identity verification",
    "Venmo verify identity",
    "Venmo identity verification",
    "Chime verify identity",
    "Zelle verify identity",
    "Binance verify identity",
    "Binance KYC failed",
    "Coinbase verify identity",
    "Coinbase identity verification failed",
    "Uber verify identity",
    "Uber driver ID verification",
    "Lyft verify identity",
    "Lyft driver ID verification",
    "Instacart verify identity",
    "Instacart ID verification failed",
    "Amazon Flex verify identity",
    "Grubhub verify identity",
    "Shipt verify identity",
    "Spark driver verify identity",
]


def collect_tier4():
    """Tier 4: Persona competitor and IDV company searches."""
    return _collect_global_queries(TIER4_COMPETITOR_QUERIES, "tier4_competitors", "search_competitors")


def collect_tier5():
    """Tier 5: Deep KYC/AML/IDV experience searches."""
    return _collect_global_queries(TIER5_KYC_QUERIES, "tier5_kyc_deep", "search_kyc_deep")


def _collect_subreddit_keyword_searches(subreddit_searches: dict, tier_name: str, source_tag: str):
    """Search within specific subreddits using keyword queries (like Tier 2)."""
    total_inserted = 0
    total_fetched = 0
    failed = 0

    for sub_name, queries in subreddit_searches.items():
        for query in queries:
            url = f"{REDDIT_BASE_URL}/r/{sub_name}/search.json"
            params = {
                "q": query,
                "restrict_sr": "on",
                "sort": "relevance",
                "t": "year",
                "limit": 100,
            }
            source = f"{source_tag}_sub"

            log.info(f"[{tier_name}] Searching r/{sub_name} for '{query}'...")

            try:
                posts = _paginated_fetch(url, params, source,
                                         search_query=query, max_pages=10)
                total_fetched += len(posts)
                if posts:
                    inserted = insert_posts_batch(posts)
                    total_inserted += inserted
                    log.info(f"  r/{sub_name} '{query}': {len(posts)} fetched, {inserted} new")
            except Exception as e:
                log.error(f"Error searching r/{sub_name} for '{query}': {e}")
                failed += 1

            time.sleep(REDDIT_REQUEST_DELAY)

        log.info(f"  r/{sub_name} done.")

    return total_fetched, total_inserted, failed


def _collect_mixed_tier(subreddit_searches: dict, global_queries: list[str],
                        tier_name: str, source_tag: str):
    """Collect from both subreddit keyword searches and global queries."""
    run_id = start_run("initial_collection", tier_name,
                       {"subreddits": list(subreddit_searches.keys()),
                        "global_query_count": len(global_queries)})

    total_fetched = 0
    total_inserted = 0
    total_failed = 0

    # Part 1: Subreddit-specific keyword searches
    if subreddit_searches:
        fetched, inserted, failed = _collect_subreddit_keyword_searches(
            subreddit_searches, tier_name, source_tag)
        total_fetched += fetched
        total_inserted += inserted
        total_failed += failed

    # Part 2: Global queries
    if global_queries:
        for query in global_queries:
            url = f"{REDDIT_BASE_URL}/search.json"
            params = {
                "q": query,
                "sort": "relevance",
                "t": "year",
                "limit": 100,
            }

            log.info(f"[{tier_name}] Global search: '{query}'...")

            try:
                posts = _paginated_fetch(url, params, f"{source_tag}_global",
                                         search_query=query, max_pages=10)
                total_fetched += len(posts)
                if posts:
                    inserted = insert_posts_batch(posts)
                    total_inserted += inserted
                    log.info(f"  '{query}': {len(posts)} fetched, {inserted} new")
            except Exception as e:
                log.error(f"Error in global search for '{query}': {e}")
                total_failed += 1

            time.sleep(REDDIT_REQUEST_DELAY)

    finish_run(run_id, total_fetched, total_inserted, total_failed)
    log.info(f"{tier_name} complete: {total_fetched} fetched, {total_inserted} new inserts")
    return total_inserted


def collect_tier6():
    """Tier 6: Persona client company searches."""
    return _collect_global_queries(TIER6_PERSONA_CLIENT_QUERIES, "tier6_persona_clients", "search_persona_clients")


def collect_tier7():
    """Tier 7: Social media & consumer platform verification searches."""
    return _collect_global_queries(TIER7_SOCIAL_PLATFORM_QUERIES, "tier7_social_platforms", "search_social_platforms")


def collect_tier8():
    """Tier 8: Fintech & gig economy verification searches."""
    return _collect_global_queries(TIER8_FINTECH_GIG_QUERIES, "tier8_fintech_gig", "search_fintech_gig")


# Tier 9: Government & public sector verification
TIER9_SUBREDDIT_SEARCHES = {
    "IRS": [
        "verify identity", "identity verification", "ID.me", "Login.gov",
        "identity pin", "5071C", "5747C",
    ],
    "SocialSecurity": [
        "verify identity", "identity verification", "Login.gov", "ID.me",
        "my social security account",
    ],
    "VeteransBenefits": [
        "verify identity", "ID.me", "Login.gov", "identity verification",
    ],
    "Unemployment": [
        "verify identity", "identity verification", "ID.me", "EDD",
        "identity fraud", "unemployment fraud",
    ],
    "legaladvice": [
        "identity theft", "identity fraud", "someone opened account in my name",
        "identity stolen", "stolen identity",
    ],
}

TIER9_GLOBAL_QUERIES = [
    "verify identity IRS",
    "Login.gov verify identity",
    "Login.gov identity verification failed",
    "EDD identity verification",
    "SSA verify identity",
    "government ID verification",
    "in person verify identity post office",
    "Real ID verification",
    "identity verification letter",
    "unemployment identity fraud",
    "TSA PreCheck verification",
]

# Tier 10: Privacy, bias & accessibility
TIER10_SUBREDDIT_SEARCHES = {
    "privacy": [
        "KYC", "identity verification", "biometric", "facial recognition",
        "selfie verification", "face scan", "ID verification", "liveness",
        "verify identity", "upload ID",
    ],
}

TIER10_GLOBAL_QUERIES = [
    "biometric KYC privacy",
    "face scan privacy concern",
    "selfie verification privacy",
    "facial recognition bias",
    "identity verification disabled",
    "identity verification no ID",
    "accessibility KYC",
    "biometric data breach",
    "identity verification dark skin failed",
    "facial recognition bias verification",
    "elderly identity verification",
    "blind identity verification",
    "refuse upload ID verification",
    "data retention selfie ID scan",
]

# Tier 11: Dating, gambling & niche vertical verification
TIER11_SUBREDDIT_SEARCHES = {
    "Tinder": [
        "verify", "verification", "catfish verified", "ID verification",
    ],
    "Bumble": [
        "verify", "verification", "photo verification",
    ],
    "OnlineDating": [
        "verify identity", "verification", "catfish",
    ],
    "DraftKings": [
        "verify identity", "KYC", "identity verification",
    ],
    "fanduel": [
        "verify identity", "KYC", "identity verification",
    ],
    "sportsbook": [
        "KYC", "verify identity", "identity verification",
    ],
}

TIER11_GLOBAL_QUERIES = [
    "dating app verification",
    "Tinder verify identity",
    "Bumble verification scam",
    "catfish verified profile",
    "fake verified profile",
    "verified badge scam",
    "online casino KYC",
    "sports betting verify identity",
    "DraftKings identity verification",
    "gambling KYC failed",
    "online gambling identity check",
    "telehealth identity verification",
    "apartment identity verification",
    "rental application identity theft",
    "tenant screening fraud",
    "online exam identity verification",
    "proctoring identity check",
]

# Tier 12: Fraud techniques, friction vocabulary & account recovery
TIER12_SUBREDDIT_SEARCHES = {
    "doordash_drivers": [
        "verification", "deactivated", "Checkr", "background check",
        "identity", "verify",
    ],
    "uberdrivers": [
        "verification", "deactivated", "identity", "Checkr",
        "background check", "verify",
    ],
    "InstacartShoppers": [
        "verification", "deactivated", "identity", "verify",
    ],
    "SocialEngineering": [
        "identity", "verification bypass", "impersonation",
        "pretexting", "vishing",
    ],
    "Coinbase": [
        "verify identity", "KYC", "identity verification", "ID verification",
    ],
    "netsec": [
        "identity verification", "liveness detection", "biometric bypass",
        "deepfake", "credential stuffing",
    ],
}

TIER12_GLOBAL_QUERIES = [
    "synthetic identity fraud",
    "synthetic identity",
    "mule account fraud",
    "money mule",
    "account takeover identity",
    "AI generated fake ID",
    "camera injection attack biometric",
    "manual review verification stuck",
    "verification loop stuck",
    "document rejected verification",
    "name mismatch verification",
    "stuck on selfie verification",
    "verification pending weeks",
    "account locked verify identity",
    "can't verify this account belongs to me",
    "recovery denied identity",
    "account recovery verify identity",
    "port out scam",
    "credential stuffing attack",
    "identity fraud as a service",
]


def collect_tier9():
    """Tier 9: Government & public sector verification searches."""
    return _collect_mixed_tier(TIER9_SUBREDDIT_SEARCHES, TIER9_GLOBAL_QUERIES,
                               "tier9_government", "search_government")


def collect_tier10():
    """Tier 10: Privacy, bias & accessibility searches."""
    return _collect_mixed_tier(TIER10_SUBREDDIT_SEARCHES, TIER10_GLOBAL_QUERIES,
                                "tier10_privacy", "search_privacy")


def collect_tier11():
    """Tier 11: Dating, gambling & niche vertical verification searches."""
    return _collect_mixed_tier(TIER11_SUBREDDIT_SEARCHES, TIER11_GLOBAL_QUERIES,
                                "tier11_verticals", "search_verticals")


def collect_tier12():
    """Tier 12: Fraud techniques, friction vocabulary & account recovery."""
    return _collect_mixed_tier(TIER12_SUBREDDIT_SEARCHES, TIER12_GLOBAL_QUERIES,
                                "tier12_techniques", "search_techniques")


def collect_all():
    """Run all collection tiers."""
    log.info("Starting Reddit collection (using .json endpoints)...")

    for name, fn in [("Tier 1", collect_tier1), ("Tier 2", collect_tier2),
                     ("Tier 3", collect_tier3), ("Tier 4", collect_tier4),
                     ("Tier 5", collect_tier5), ("Tier 6", collect_tier6),
                     ("Tier 7", collect_tier7), ("Tier 8", collect_tier8),
                     ("Tier 9", collect_tier9), ("Tier 10", collect_tier10),
                     ("Tier 11", collect_tier11), ("Tier 12", collect_tier12)]:
        result = fn()
        log.info(f"{name} done: {result} new posts")

    log.info("All collection complete.")


if __name__ == "__main__":
    collect_all()
