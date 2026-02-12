-- ============================================================
-- Fraud Landscape Intelligence Dashboard — Database Schema
-- ============================================================

-- ============================================================
-- Raw posts from Reddit
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_posts (
    -- Reddit identifiers
    post_id             TEXT PRIMARY KEY,
    post_fullname       TEXT,

    -- Content
    title               TEXT NOT NULL,
    selftext            TEXT,
    url                 TEXT,

    -- Metadata
    subreddit           TEXT NOT NULL,
    author              TEXT,
    score               INTEGER,
    upvote_ratio        REAL,
    num_comments        INTEGER,
    created_utc         TIMESTAMP NOT NULL,
    permalink           TEXT,

    -- Post flags
    is_self             BOOLEAN,
    over_18             BOOLEAN,
    link_flair_text     TEXT,
    stickied            BOOLEAN,
    locked              BOOLEAN,

    -- Collection metadata
    collection_source   TEXT,
    search_query        TEXT,
    collected_at        TIMESTAMP DEFAULT NOW(),

    -- Pre-filter flag (skipped before LLM pass)
    pre_filtered_out    BOOLEAN DEFAULT FALSE,

    -- Pass 1: Boolean routing (is_fraud / is_idv)
    is_fraud            BOOLEAN,
    is_idv              BOOLEAN,
    refilter_confidence REAL,
    refilter_done       BOOLEAN DEFAULT FALSE,

    -- Comment collection flag
    comments_fetched    BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_raw_posts_subreddit ON raw_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_raw_posts_created ON raw_posts(created_utc);
CREATE INDEX IF NOT EXISTS idx_raw_posts_score ON raw_posts(score);
CREATE INDEX IF NOT EXISTS idx_raw_posts_fraud ON raw_posts(is_fraud);
CREATE INDEX IF NOT EXISTS idx_raw_posts_idv ON raw_posts(is_idv);

-- ============================================================
-- Comments (fetched for relevant posts)
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    comment_id          TEXT PRIMARY KEY,
    post_id             TEXT NOT NULL REFERENCES raw_posts(post_id),

    -- Content
    body                TEXT,
    author              TEXT,
    score               INTEGER,
    created_utc         TIMESTAMP,

    -- Threading
    parent_id           TEXT,
    is_submitter        BOOLEAN,
    depth               INTEGER,

    -- Metadata
    permalink           TEXT,
    stickied            BOOLEAN,
    distinguished       TEXT,

    collected_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_score ON comments(score DESC);

-- ============================================================
-- Pass 2: Fraud deep classification
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_classifications (
    post_id             TEXT PRIMARY KEY REFERENCES raw_posts(post_id),

    is_relevant         BOOLEAN,
    fraud_type          TEXT,
    industry            TEXT,
    loss_bracket        TEXT,
    channel             TEXT,
    notable_quote       TEXT,
    tags                JSONB,

    llm_model           TEXT,
    classified_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_type ON fraud_classifications(fraud_type);
CREATE INDEX IF NOT EXISTS idx_fraud_industry ON fraud_classifications(industry);

-- ============================================================
-- Pass 2: IDV deep classification
-- ============================================================
CREATE TABLE IF NOT EXISTS idv_classifications (
    post_id             TEXT PRIMARY KEY REFERENCES raw_posts(post_id),

    is_relevant         BOOLEAN,
    verification_type   TEXT,
    friction_type       TEXT,
    trigger_reason      TEXT,
    platform_name       TEXT,
    sentiment           TEXT,
    notable_quote       TEXT,
    tags                JSONB,

    llm_model           TEXT,
    classified_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idv_verification_type ON idv_classifications(verification_type);
CREATE INDEX IF NOT EXISTS idx_idv_friction_type ON idv_classifications(friction_type);
CREATE INDEX IF NOT EXISTS idx_idv_sentiment ON idv_classifications(sentiment);

-- ============================================================
-- Collection run tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS collection_runs (
    run_id              SERIAL PRIMARY KEY,
    run_type            TEXT NOT NULL,
    phase               TEXT NOT NULL,
    run_status          TEXT DEFAULT 'running',
    started_at          TIMESTAMP DEFAULT NOW(),
    completed_at        TIMESTAMP,

    -- Stats
    items_processed     INTEGER DEFAULT 0,
    items_successful    INTEGER DEFAULT 0,
    items_failed        INTEGER DEFAULT 0,

    -- Error tracking
    last_error          TEXT,

    -- Config snapshot
    config_snapshot     JSONB
);
