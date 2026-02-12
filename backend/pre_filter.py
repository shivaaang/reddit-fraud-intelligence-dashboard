"""Pre-filter posts before sending to LLM.

Cheaply eliminates obviously unusable posts (deleted content, negative score)
to save LLM API calls.
"""

from backend.db import get_posts_for_prefilter, mark_pre_filtered
from backend.utils import setup_logger

log = setup_logger("pre_filter")

# Titles that indicate deleted/useless content
SKIP_TITLES = {"[deleted]", "[removed]", ""}


def run_pre_filter():
    """Mark posts that should skip LLM filtering."""
    rows = get_posts_for_prefilter()

    to_skip = []
    reasons = {"deleted_content": 0, "negative_score": 0, "no_text_content": 0}

    for row in rows:
        title = (row["title"] or "").strip()
        body = (row["selftext"] or "").strip()
        score = row["score"] or 0

        # Skip if title is deleted/empty AND body is also empty/deleted
        if title in SKIP_TITLES and body in ("[deleted]", "[removed]", ""):
            to_skip.append(row["post_id"])
            reasons["deleted_content"] += 1
            continue

        # Skip posts with negative score (community-rejected)
        if score < 0:
            to_skip.append(row["post_id"])
            reasons["negative_score"] += 1
            continue

        # Skip image/link/video posts with no body text AND short title
        # (not enough content for LLM to meaningfully classify)
        if body in ("", "[deleted]", "[removed]") and len(title) < 30:
            to_skip.append(row["post_id"])
            reasons["no_text_content"] += 1
            continue

    if to_skip:
        mark_pre_filtered(to_skip)

    log.info(f"Pre-filter complete: {len(to_skip)} posts filtered out of {len(rows)} checked")
    for reason, count in reasons.items():
        if count > 0:
            log.info(f"  {reason}: {count}")
    return len(to_skip)


if __name__ == "__main__":
    run_pre_filter()
