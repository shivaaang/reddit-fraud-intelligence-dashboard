import json
import psycopg2
from psycopg2 import pool, extras
from contextlib import contextmanager
from backend.config import DATABASE_URL

_pool = None


def get_pool():
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(1, 25, DATABASE_URL)
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


def update_post_relevance(post_id: str, is_relevant: bool, confidence: float,
                          topic_hint: str, language: str = None,
                          category: str = None):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                UPDATE raw_posts
                SET is_relevant = %s,
                    relevance_confidence = %s,
                    relevance_topic_hint = %s,
                    relevance_language = %s,
                    relevance_category = %s,
                    relevance_filtered_at = NOW()
                WHERE post_id = %s
            """, (is_relevant, confidence, topic_hint, language, category, post_id))


def mark_pre_filtered(post_ids: list[str]):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                UPDATE raw_posts
                SET pre_filtered_out = TRUE,
                    is_relevant = FALSE,
                    relevance_confidence = 1.0,
                    relevance_topic_hint = 'pre_filtered',
                    relevance_filtered_at = NOW()
                WHERE post_id = ANY(%s)
            """, (post_ids,))


def insert_classification(post_id: str, classification: dict, model_used: str):
    classification["post_id"] = post_id
    classification["llm_model_used"] = model_used

    cols = [
        "post_id", "fraud_type", "fraud_type_secondary", "fraud_vector",
        "severity", "financial_loss_mentioned", "loss_amount_usd",
        "industry", "platform_mentioned", "geographic_region",
        "involves_ai", "ai_technique_mentioned",
        "verification_mentioned", "verification_type",
        "verification_sentiment", "verification_context",
        "post_type", "victim_sentiment", "resolution_status",
        "summary", "llm_model_used",
    ]
    col_names = ", ".join(cols)
    placeholders = ", ".join(["%s"] * len(cols))
    values = [classification.get(c) for c in cols]

    sql = f"""
        INSERT INTO classifications ({col_names})
        VALUES ({placeholders})
        ON CONFLICT (post_id) DO NOTHING
    """
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(sql, values)
            if cur.rowcount > 0:
                cur.execute(
                    "UPDATE raw_posts SET classification_done = TRUE WHERE post_id = %s",
                    (post_id,),
                )


def get_unfiltered_posts(batch_size: int = 50, offset: int = 0):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT post_id, title, selftext, subreddit, score, num_comments
                FROM raw_posts
                WHERE is_relevant IS NULL
                  AND pre_filtered_out = FALSE
                ORDER BY post_id
                LIMIT %s OFFSET %s
            """, (batch_size, offset))
            return cur.fetchall()


def get_unfiltered_count():
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT COUNT(*) as cnt FROM raw_posts
                WHERE is_relevant IS NULL AND pre_filtered_out = FALSE
            """)
            return cur.fetchone()["cnt"]


def get_relevant_posts_without_comments(batch_size: int = 100):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT post_id
                FROM raw_posts
                WHERE is_relevant = TRUE
                  AND comments_fetched = FALSE
                ORDER BY score DESC
                LIMIT %s
            """, (batch_size,))
            return [r["post_id"] for r in cur.fetchall()]


def get_unclassified_posts(batch_size: int = 50):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT p.post_id, p.title, p.selftext, p.subreddit,
                       p.score, p.num_comments, p.created_utc
                FROM raw_posts p
                WHERE p.is_relevant = TRUE
                  AND p.classification_done = FALSE
                ORDER BY p.score DESC
                LIMIT %s
            """, (batch_size,))
            return cur.fetchall()


def get_top_comments_for_post(post_id: str, limit: int = 8):
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT body, score, author
                FROM comments
                WHERE post_id = %s
                ORDER BY score DESC
                LIMIT %s
            """, (post_id, limit))
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
                    COUNT(*) FILTER (WHERE is_relevant = TRUE) as relevant_posts,
                    COUNT(*) FILTER (WHERE is_relevant = FALSE) as irrelevant_posts,
                    COUNT(*) FILTER (WHERE is_relevant IS NULL AND pre_filtered_out = FALSE) as unfiltered_posts,
                    COUNT(*) FILTER (WHERE pre_filtered_out = TRUE) as pre_filtered_posts,
                    COUNT(*) FILTER (WHERE comments_fetched = TRUE) as comments_fetched_posts,
                    COUNT(*) FILTER (WHERE classification_done = TRUE) as classified_posts
                FROM raw_posts
            """)
            return cur.fetchone()
