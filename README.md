# Fraud Landscape Intelligence Dashboard

An analysis of 40,000+ Reddit posts about fraud, scams, and identity verification — structured into a queryable dataset for product intelligence.

Built as a showcase project for Persona (identity verification infrastructure).

## What This Is

A data pipeline that collects Reddit posts discussing fraud and identity verification, then classifies them using LLMs into structured fields (fraud type, industry, loss bracket, verification method, friction type, etc.). The result is a dataset that answers questions like:

- What types of fraud are people talking about most?
- Which industries have the worst identity verification experiences?
- Where does verification friction cause users to abandon platforms?
- What fraud patterns could identity verification have prevented?

## Architecture

```
┌──────────────────┐     ┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Reddit .json    │────▶│  Pass 1:       │────▶│  Comment         │────▶│  Pass 2:         │
│  Collection      │     │  Boolean       │     │  Collection      │     │  Deep            │
│  (12 tiers)      │     │  Routing       │     │  (top 5/post)    │     │  Classification  │
│                  │     │  (GPT-OSS-120B)│     │                  │     │  (DeepSeek V3.2) │
│  40,391 posts    │     │  is_fraud?     │     │  ~100K comments  │     │  7-10 fields     │
│                  │     │  is_idv?       │     │                  │     │  per post        │
└──────────────────┘     └────────────────┘     └──────────────────┘     └──────────────────┘
                                                                                  │
                                                                                  ▼
                                                                        ┌──────────────────┐
                                                                        │  Neon PostgreSQL  │
                                                                        │                  │
                                                                        │  raw_posts       │
                                                                        │  comments        │
                                                                        │  fraud_class.    │
                                                                        │  idv_class.      │
                                                                        └──────────────────┘
```

## Data Summary

| Metric | Count |
|--------|-------|
| Total posts collected | 40,316 |
| Pre-filtered (deleted/empty) | 277 |
| Pass 1: Fraud-flagged | 12,556 |
| Pass 1: IDV-flagged | 10,360 |
| Pass 1: Both | 2,154 |
| Pass 2: Fraud relevant | 8,739 |
| Pass 2: IDV relevant | 7,720 |

## Tech Stack

- **Language:** Python 3.11+
- **Database:** Neon PostgreSQL (serverless)
- **Pass 1 LLM:** OpenRouter → `openai/gpt-oss-120b` (boolean routing with structured output)
- **Pass 2 LLM:** OpenRouter → `deepseek/deepseek-v3.2` (deep classification with Pydantic validation)
- **HTTP Client:** httpx
- **Data Source:** Reddit public `.json` endpoints (no API key required)

## Schema Overview

**`raw_posts`** — Reddit posts with Pass 1 routing flags (`is_fraud`, `is_idv`)

**`comments`** — Top 5 comments per relevant post (used as context for Pass 2)

**`fraud_classifications`** — Deep classification: `fraud_type`, `industry`, `loss_bracket`, `channel`, `notable_quote`, `tags`

**`idv_classifications`** — Deep classification: `verification_type`, `friction_type`, `trigger_reason`, `platform_name`, `sentiment`, `notable_quote`, `tags`

**`collection_runs`** — Pipeline run tracking and error logging

Full schema: [`sql/schema.sql`](sql/schema.sql)

## Setup

```bash
# Clone and install
git clone <repo-url>
cd reddit-identity-dashboard
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with your DATABASE_URL and OPENROUTER_API_KEY
```

## Running the Pipeline

Every phase runs through a single entry point:

```bash
# 1. Initialize database tables
python -m backend.pipeline init

# 2. Collect posts from Reddit (12-tier search strategy)
python -m backend.pipeline collect

# 3. Pre-filter deleted/empty posts (saves LLM calls)
python -m backend.pipeline pre-filter

# 4. Pass 1: Boolean routing (is_fraud / is_idv)
python -m backend.pipeline refilter

# 5. Fetch top comments for relevant posts
python -m backend.pipeline comments

# 6. Pass 2: Deep classification
python -m backend.pipeline pass2-fraud --workers 20
python -m backend.pipeline pass2-idv --workers 20

# Check progress at any time
python -m backend.pipeline stats
```

## File Structure

```
├── .env.example            # Environment variable template
├── .gitignore
├── requirements.txt        # Python dependencies
├── README.md
├── PROCESS.md              # Pipeline build narrative and decisions
├── PROMPT_DESIGN.md        # Prompt design decisions for Pass 1 and Pass 2
│
├── backend/
│   ├── __init__.py
│   ├── pipeline.py           # CLI entry point — runs all phases
│   ├── reddit_collector.py   # Phase 1: Reddit post collection (12 tiers)
│   ├── pre_filter.py         # Phase 2: Cheap pre-filter (deleted/empty posts)
│   ├── pass1_classifier.py   # Phase 3: Boolean classification (is_fraud / is_idv)
│   ├── comment_collector.py  # Phase 4: Fetch top comments for relevant posts
│   ├── pass2_classifier.py   # Phase 5: Deep classification (DeepSeek V3.2)
│   ├── llm_client.py         # OpenRouter API clients (Pass 1: GPT-OSS-120B, Pass 2: DeepSeek V3.2)
│   ├── db.py                 # Database connection pool and all SQL operations
│   ├── config.py             # Environment-based configuration
│   └── utils.py              # Logging setup
│
└── sql/
    └── schema.sql            # Database schema (source of truth)
```

## Related Docs

- [`PROCESS.md`](PROCESS.md) — How the pipeline was built, decisions made, and lessons learned
- [`PROMPT_DESIGN.md`](PROMPT_DESIGN.md) — Prompt design decisions, taxonomy rationale, and accuracy tables
