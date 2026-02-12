import json
import psycopg2
from psycopg2 import pool, extras
from contextlib import contextmanager
from backend.config import DATABASE_URL

_pool = None


def get_pool():
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(1, 40, DATABASE_URL)
    return _pool


@contextmanager
def get_conn():
    p = get_pool()
    conn = p.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        p.putconn(conn)


@contextmanager
def get_cursor(conn=None):
    if conn is not None:
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)
        try:
            yield cur
        finally:
            cur.close()
    else:
        with get_conn() as conn:
            cur = conn.cursor(cursor_factory=extras.RealDictCursor)
            try:
                yield cur
            finally:
                cur.close()


def init_schema(schema_path: str = "sql/schema.sql"):
    with open(schema_path) as f:
        sql = f.read()
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(sql)


def insert_post(post_data: dict):
    cols = [
        "post_id", "post_fullname", "title", "selftext", "url",
        "subreddit", "author", "score", "upvote_ratio", "num_comments",
        "created_utc", "permalink", "is_self", "over_18",
        "link_flair_text", "stickied", "locked",
        "collection_source", "search_query",
    ]
    placeholders = ", ".join(["%s"] * len(cols))
    col_names = ", ".join(cols)
    values = [post_data.get(c) for c in cols]

    sql = f"""
        INSERT INTO raw_posts ({col_names})
        VALUES ({placeholders})
        ON CONFLICT (post_id) DO NOTHING
    """
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(sql, values)
            return cur.rowcount > 0  # True if inserted, False if duplicate


def insert_posts_batch(posts: list[dict]):
    cols = [
        "post_id", "post_fullname", "title", "selftext", "url",
        "subreddit", "author", "score", "upvote_ratio", "num_comments",
        "created_utc", "permalink", "is_self", "over_18",
        "link_flair_text", "stickied", "locked",
        "collection_source", "search_query",
    ]
    col_names = ", ".join(cols)
    placeholders = ", ".join(["%s"] * len(cols))

    sql = f"""
        INSERT INTO raw_posts ({col_names})
        VALUES ({placeholders})
        ON CONFLICT (post_id) DO NOTHING
    """
    rows = [[p.get(c) for c in cols] for p in posts]

    with get_conn() as conn:
        with get_cursor(conn) as cur:
            inserted = 0
            for row in rows:
                cur.execute(sql, row)
                inserted += cur.rowcount
            return inserted


def insert_comments_batch(comments: list[dict]):
    cols = [
        "comment_id", "post_id", "body", "author", "score",
        "created_utc", "parent_id", "is_submitter", "depth",
        "permalink", "stickied", "distinguished",
    ]
    col_names = ", ".join(cols)
    placeholders = ", ".join(["%s"] * len(cols))

    sql = f"""
        INSERT INTO comments ({col_names})
        VALUES ({placeholders})
        ON CONFLICT (comment_id) DO NOTHING
    """
    rows = [[c.get(col) for col in cols] for c in comments]

    with get_conn() as conn:
        with get_cursor(conn) as cur:
            inserted = 0
            for row in rows:
                cur.execute(sql, row)
                inserted += cur.rowcount
            return inserted


def mark_comments_fetched(post_id: str):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "UPDATE raw_posts SET comments_fetched = TRUE WHERE post_id = %s",
                (post_id,),
            )


def mark_pre_filtered(post_ids: list[str]):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                UPDATE raw_posts
                SET pre_filtered_out = TRUE
                WHERE post_id = ANY(%s)
            """, (post_ids,))


# ---- Pass 1: Refilter functions ----

def update_post_refilter(post_id: str, is_fraud: bool, is_idv: bool, confidence: float):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                UPDATE raw_posts
                SET is_fraud = %s,
                    is_idv = %s,
                    refilter_confidence = %s,
                    refilter_done = TRUE
                WHERE post_id = %s
            """, (is_fraud, is_idv, confidence, post_id))


def get_unrefiltered_posts(batch_size: int = 50):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT post_id, title, selftext, subreddit, score, num_comments
                FROM raw_posts
                WHERE refilter_done = FALSE
                  AND pre_filtered_out IS NOT TRUE
                ORDER BY post_id
                LIMIT %s
            """, (batch_size,))
            return cur.fetchall()


def get_unrefiltered_count():
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT COUNT(*) as cnt FROM raw_posts
                WHERE refilter_done = FALSE AND pre_filtered_out IS NOT TRUE
            """)
            return cur.fetchone()["cnt"]


def get_random_unrefiltered_posts(sample_size: int):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT post_id, title, selftext, subreddit, score, num_comments
                FROM raw_posts
                WHERE refilter_done = FALSE
                  AND pre_filtered_out IS NOT TRUE
                ORDER BY RANDOM()
                LIMIT %s
            """, (sample_size,))
            return cur.fetchall()


# ---- Comment functions ----

def get_relevant_posts_without_comments(batch_size: int = 100):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT post_id
                FROM raw_posts
                WHERE (is_fraud = TRUE OR is_idv = TRUE)
                  AND comments_fetched = FALSE
                  AND num_comments > 0
                ORDER BY score DESC
                LIMIT %s
            """, (batch_size,))
            return [r["post_id"] for r in cur.fetchall()]


def get_top_comments_for_post(post_id: str, limit: int = 5):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT body, score, author, is_submitter
                FROM comments
                WHERE post_id = %s
                ORDER BY is_submitter DESC, score DESC
                LIMIT %s
            """, (post_id, limit))
            return cur.fetchall()


# ---- Pre-filter functions ----

def get_posts_for_prefilter():
    """Get posts that haven't been pre-filtered or refiltered yet."""
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT post_id, title, selftext, score
                FROM raw_posts
                WHERE refilter_done = FALSE
                  AND pre_filtered_out = FALSE
            """)
            return cur.fetchall()


# ---- Classification functions ----

def insert_fraud_classification(post_id: str, classification: dict, model: str = None):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                INSERT INTO fraud_classifications
                    (post_id, is_relevant, fraud_type, industry, loss_bracket, channel,
                     notable_quote, tags, llm_model)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (post_id) DO UPDATE SET
                    is_relevant = EXCLUDED.is_relevant,
                    fraud_type = EXCLUDED.fraud_type,
                    industry = EXCLUDED.industry,
                    loss_bracket = EXCLUDED.loss_bracket,
                    channel = EXCLUDED.channel,
                    notable_quote = EXCLUDED.notable_quote,
                    tags = EXCLUDED.tags,
                    llm_model = EXCLUDED.llm_model,
                    classified_at = NOW()
            """, (
                post_id,
                classification.get("is_relevant", True),
                classification["fraud_type"],
                classification["industry"],
                classification["loss_bracket"],
                classification["channel"],
                classification.get("notable_quote"),
                json.dumps(classification.get("tags", [])),
                model,
            ))


def insert_idv_classification(post_id: str, classification: dict, model: str = None):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                INSERT INTO idv_classifications
                    (post_id, is_relevant, verification_type, friction_type,
                     trigger_reason, platform_name, sentiment,
                     notable_quote, tags, llm_model)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (post_id) DO UPDATE SET
                    is_relevant = EXCLUDED.is_relevant,
                    verification_type = EXCLUDED.verification_type,
                    friction_type = EXCLUDED.friction_type,
                    trigger_reason = EXCLUDED.trigger_reason,
                    platform_name = EXCLUDED.platform_name,
                    sentiment = EXCLUDED.sentiment,
                    notable_quote = EXCLUDED.notable_quote,
                    tags = EXCLUDED.tags,
                    llm_model = EXCLUDED.llm_model,
                    classified_at = NOW()
            """, (
                post_id,
                classification.get("is_relevant", True),
                classification["verification_type"],
                classification["friction_type"],
                classification.get("trigger_reason", "unknown"),
                classification.get("platform_name"),
                classification["sentiment"],
                classification.get("notable_quote"),
                json.dumps(classification.get("tags", [])),
                model,
            ))


def get_unclassified_fraud_posts(batch_size: int = 50):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT p.post_id, p.title, p.selftext, p.subreddit,
                       p.score, p.num_comments, p.created_utc
                FROM raw_posts p
                WHERE p.is_fraud = TRUE
                  AND p.post_id NOT IN (SELECT post_id FROM fraud_classifications)
                ORDER BY p.score DESC
                LIMIT %s
            """, (batch_size,))
            return cur.fetchall()


def get_unclassified_idv_posts(batch_size: int = 50):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT p.post_id, p.title, p.selftext, p.subreddit,
                       p.score, p.num_comments, p.created_utc
                FROM raw_posts p
                WHERE p.is_idv = TRUE
                  AND p.post_id NOT IN (SELECT post_id FROM idv_classifications)
                ORDER BY p.score DESC
                LIMIT %s
            """, (batch_size,))
            return cur.fetchall()


def start_run(run_type: str, phase: str, config: dict = None):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                INSERT INTO collection_runs (run_type, phase, config_snapshot)
                VALUES (%s, %s, %s)
                RETURNING run_id
            """, (run_type, phase, json.dumps(config) if config else None))
            return cur.fetchone()["run_id"]


def finish_run(run_id: int, processed: int, successful: int, failed: int,
               status: str = "completed", error: str = None):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                UPDATE collection_runs
                SET run_status = %s,
                    completed_at = NOW(),
                    items_processed = %s,
                    items_successful = %s,
                    items_failed = %s,
                    last_error = %s
                WHERE run_id = %s
            """, (status, processed, successful, failed, error, run_id))


def get_collection_stats():
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT
                    COUNT(*) as total_posts,
                    COUNT(*) FILTER (WHERE pre_filtered_out = TRUE) as pre_filtered_posts,
                    COUNT(*) FILTER (WHERE refilter_done = TRUE) as refiltered_posts,
                    COUNT(*) FILTER (WHERE refilter_done = FALSE AND pre_filtered_out IS NOT TRUE) as unrefiltered_posts,
                    COUNT(*) FILTER (WHERE is_fraud = TRUE) as fraud_posts,
                    COUNT(*) FILTER (WHERE is_idv = TRUE) as idv_posts,
                    COUNT(*) FILTER (WHERE is_fraud = TRUE AND is_idv = TRUE) as both_posts,
                    COUNT(*) FILTER (WHERE is_fraud = FALSE AND is_idv = FALSE AND refilter_done = TRUE) as neither_posts,
                    COUNT(*) FILTER (WHERE comments_fetched = TRUE) as comments_fetched_posts
                FROM raw_posts
            """)
            stats = cur.fetchone()

            # Classification counts
            cur.execute("SELECT COUNT(*) as cnt FROM fraud_classifications")
            stats["fraud_classified"] = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) as cnt FROM idv_classifications")
            stats["idv_classified"] = cur.fetchone()["cnt"]

            return stats


# ---- Pass 2: Ready post fetching ----

def get_ready_unclassified_posts(track: str, batch_size: int = 500, random_order: bool = False):
    """Get unclassified posts that have comments fetched and are ready for Pass 2.

    Args:
        track: "fraud" or "idv"
        batch_size: max posts to return
        random_order: if True, return random sample (for testing)
    """
    if track == "fraud":
        flag, table = "is_fraud", "fraud_classifications"
    else:
        flag, table = "is_idv", "idv_classifications"

    order = "ORDER BY RANDOM()" if random_order else "ORDER BY p.score DESC"

    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(f"""
                SELECT p.post_id, p.title, p.selftext, p.subreddit,
                       p.score, p.num_comments
                FROM raw_posts p
                WHERE p.{flag} = TRUE
                  AND p.comments_fetched = TRUE
                  AND p.post_id NOT IN (SELECT post_id FROM {table})
                {order}
                LIMIT %s
            """, (batch_size,))
            return cur.fetchall()


def get_classification_progress():
    """Get Pass 2 classification progress counts."""
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM fraud_classifications")
            fraud_done = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) as cnt FROM idv_classifications")
            idv_done = cur.fetchone()["cnt"]
            cur.execute("""
                SELECT COUNT(*) as cnt FROM raw_posts
                WHERE is_fraud = TRUE AND comments_fetched = TRUE
                  AND post_id NOT IN (SELECT post_id FROM fraud_classifications)
            """)
            fraud_ready = cur.fetchone()["cnt"]
            cur.execute("""
                SELECT COUNT(*) as cnt FROM raw_posts
                WHERE is_idv = TRUE AND comments_fetched = TRUE
                  AND post_id NOT IN (SELECT post_id FROM idv_classifications)
            """)
            idv_ready = cur.fetchone()["cnt"]
            return {
                "fraud_done": fraud_done,
                "idv_done": idv_done,
                "fraud_ready": fraud_ready,
                "idv_ready": idv_ready,
            }
