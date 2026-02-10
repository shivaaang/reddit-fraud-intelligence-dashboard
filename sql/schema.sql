-- ============================================================
-- Fraud Landscape Intelligence Dashboard — Database Schema
-- ============================================================

-- ============================================================
-- PHASE 1: Raw posts from Reddit
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

    -- LLM Pass 1: Relevance filtering (populated in Phase 2)
    is_relevant         BOOLEAN,
    relevance_confidence REAL,
    relevance_topic_hint TEXT,
    relevance_language  TEXT,
    relevance_category  TEXT,
    relevance_filtered_at TIMESTAMP,

    -- Processing flags
    comments_fetched    BOOLEAN DEFAULT FALSE,
    classification_done BOOLEAN DEFAULT FALSE,

    -- Pre-filter flag (skipped before LLM pass)
    pre_filtered_out    BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_raw_posts_subreddit ON raw_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_raw_posts_created ON raw_posts(created_utc);
CREATE INDEX IF NOT EXISTS idx_raw_posts_relevant ON raw_posts(is_relevant);
CREATE INDEX IF NOT EXISTS idx_raw_posts_score ON raw_posts(score);

-- ============================================================
-- PHASE 3: Comments (only fetched for relevant posts)
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
-- PHASE 4: Deep classification results
-- ============================================================
CREATE TABLE IF NOT EXISTS classifications (
    post_id                     TEXT PRIMARY KEY REFERENCES raw_posts(post_id),

    -- Primary classification
    fraud_type                  TEXT,
    fraud_type_secondary        TEXT,
    fraud_vector                TEXT,

    -- Severity and impact
    severity                    TEXT,
    financial_loss_mentioned    BOOLEAN,
    loss_amount_usd             NUMERIC(12,2),

    -- Context
    industry                    TEXT,
    platform_mentioned          TEXT,
    geographic_region           TEXT,

    -- AI/Technology angle
    involves_ai                 BOOLEAN,
    ai_technique_mentioned      TEXT,

    -- Identity verification angle
    verification_mentioned      BOOLEAN,
    verification_type           TEXT,
    verification_sentiment      TEXT,
    verification_context        TEXT,

    -- Victim/poster perspective
    post_type                   TEXT,
    victim_sentiment            TEXT,
    resolution_status           TEXT,

    -- Generated summary
    summary                     TEXT,

    -- Metadata
    classified_at               TIMESTAMP DEFAULT NOW(),
    llm_model_used              TEXT
);

CREATE INDEX IF NOT EXISTS idx_classifications_fraud_type ON classifications(fraud_type);
CREATE INDEX IF NOT EXISTS idx_classifications_industry ON classifications(industry);
CREATE INDEX IF NOT EXISTS idx_classifications_severity ON classifications(severity);
CREATE INDEX IF NOT EXISTS idx_classifications_involves_ai ON classifications(involves_ai);
CREATE INDEX IF NOT EXISTS idx_classifications_verification ON classifications(verification_mentioned);

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
