"""Phase 3: Fetch comments for relevant posts using Reddit .json endpoints."""

import time
from datetime import datetime, timezone
from backend.config import MAX_COMMENTS_PER_POST, REDDIT_BASE_URL, REDDIT_REQUEST_DELAY
from backend.db import (
    get_relevant_posts_without_comments, insert_comments_batch,
    mark_comments_fetched, start_run, finish_run,
    get_conn, get_cursor,
)
from backend.reddit_collector import _reddit_get
from backend.utils import setup_logger

log = setup_logger("comment_collector")


def _get_post_permalink(post_id: str) -> str | None:
    """Get the permalink for a post from the database."""
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT permalink, subreddit FROM raw_posts WHERE post_id = %s",
                (post_id,),
            )
            row = cur.fetchone()
            if row and row["permalink"]:
                return row["permalink"]
            if row:
                return f"/r/{row['subreddit']}/comments/{post_id}"
            return None


def fetch_comments_for_post(post_id: str, max_comments: int = None) -> list[dict]:
    """Fetch top comments for a single post using .json endpoint."""
    max_comments = max_comments or MAX_COMMENTS_PER_POST

    permalink = _get_post_permalink(post_id)
    if not permalink:
        log.warning(f"No permalink found for post {post_id}")
        return []

    # Reddit comment endpoint: /r/{sub}/comments/{id}.json
    url = f"{REDDIT_BASE_URL}{permalink}.json"
    params = {"sort": "top", "limit": 200}

    data = _reddit_get(url, params=params)
    if data is None:
        return None  # API failure — don't mark as fetched
    if not isinstance(data, list) or len(data) < 2:
        return []

    # data[0] = post listing, data[1] = comment listing
    comment_listing = data[1]
    if "data" not in comment_listing:
        return []

    comments = []
    for child in comment_listing["data"].get("children", []):
        if child.get("kind") != "t1":
            continue

        d = child["data"]
        body = d.get("body", "")

        if body in ("[deleted]", "[removed]"):
            continue

        comments.append({
            "comment_id": d["id"],
            "post_id": post_id,
            "body": body,
            "author": d.get("author") if d.get("author") != "[deleted]" else None,
            "score": d.get("score", 0),
            "created_utc": datetime.fromtimestamp(d.get("created_utc", 0), tz=timezone.utc),
            "parent_id": d.get("parent_id", ""),
            "is_submitter": d.get("is_submitter", False),
            "depth": d.get("depth", 0),
            "permalink": d.get("permalink"),
            "stickied": d.get("stickied", False),
            "distinguished": d.get("distinguished"),
        })

        if len(comments) >= max_comments:
            break

    return comments


def _mark_zero_comment_posts():
    """Mark relevant posts with num_comments=0 as fetched (nothing to fetch)."""
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                UPDATE raw_posts
                SET comments_fetched = TRUE
                WHERE (is_fraud = TRUE OR is_idv = TRUE)
                  AND comments_fetched = FALSE
                  AND num_comments = 0
            """)
            count = cur.rowcount
    if count:
        log.info(f"Marked {count} zero-comment posts as fetched")
    return count


def run_comment_collection():
    """Fetch comments for all relevant posts that don't have comments yet."""
    _mark_zero_comment_posts()

    run_id = start_run("initial_collection", "comment_fetch")

    total_posts = 0
    total_comments = 0
    failed = 0

    while True:
        post_ids = get_relevant_posts_without_comments(batch_size=100)
        if not post_ids:
            break

        for post_id in post_ids:
            try:
                comments = fetch_comments_for_post(post_id)
                if comments is None:
                    # API failure (429, network error) — skip, don't mark
                    failed += 1
                    time.sleep(5)  # back off on failure
                    continue
                if comments:
                    inserted = insert_comments_batch(comments)
                    total_comments += inserted
                mark_comments_fetched(post_id)
                total_posts += 1

                if total_posts % 50 == 0:
                    log.info(
                        f"Progress: {total_posts} posts processed, "
                        f"{total_comments} comments collected, {failed} failures"
                    )

            except Exception as e:
                log.error(f"Error fetching comments for {post_id}: {e}")
                failed += 1

            time.sleep(REDDIT_REQUEST_DELAY)

    finish_run(run_id, total_posts, total_posts - failed, failed)
    log.info(
        f"Comment collection complete. {total_posts} posts, "
        f"{total_comments} comments, {failed} failures"
    )
    return total_comments


if __name__ == "__main__":
    run_comment_collection()
