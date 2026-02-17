# Fraud & Identity Verification Intelligence Dashboard

An interactive dashboard built on 49,000+ classified Reddit posts, exploring the fraud landscape and identity verification friction across industries, platforms, and verification methods.

### **[View Live Dashboard →](https://idv-dashboard.shivaang.com)**

## What This Is

A full-stack intelligence tool that transforms unstructured Reddit discussions into structured, explorable data. The project has two parts:

1. **Data Pipeline** (Python): Collects public Reddit posts discussing fraud and identity verification, then classifies them through a two-pass LLM pipeline into structured fields: fraud type, industry, loss bracket, verification method, friction type, sentiment, and more.

2. **Interactive Dashboard** (Next.js): Presents the classified data through charts, cross-dimensional drill-downs, and post-level analysis across two focused analytical tabs.

## Architecture

```
                              DATA PIPELINE
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Reddit     │──▶│  Pre-filter  │──▶│   Pass 1:    │──▶│   Comment    │
│  Collection  │   │              │   │   Boolean    │   │  Enrichment  │
│  (21 tiers)  │   │  40,316      │   │   Routing    │   │  (top 5/post)│
│  49,499 posts│   │  retained    │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
                                                                │
                                                                ▼
                                                         ┌──────────────┐
                                                         │   Pass 2:    │
                                                         │   Deep       │
                                                         │  Classific.  │
                                                         │  7-10 fields │
                                                         └──────┬───────┘
                                                                │
                              DASHBOARD                         ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Interactive  │◀──│  Server      │◀──│  Neon        │◀──│  8,739 fraud │
│  Charts &    │   │  Components  │   │  PostgreSQL  │   │  11,737 IDV  │
│  Drill-downs │   │  + API Routes│   │  (serverless)│   │  classified  │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

## Data Summary

| Metric | Count |
|--------|-------|
| Total posts collected | 49,499 |
| Unique subreddits | 7,393 |
| Total comments | 81,662 |
| Pass 1: Fraud-flagged | 12,556 |
| Pass 1: IDV-flagged | 14,595 |
| Pass 1: Both | 2,154 |
| Pass 2: Fraud relevant | 8,739 |
| Pass 2: IDV relevant | 11,737 |

## Dashboard

The dashboard is organized into two tabs, each providing a complete analytical view of its domain.

### Identity Verification Tab

Explores where and why identity verification creates friction for users.

- **KPI strip**: Total posts, sentiment breakdown, top friction type, top verification method
- **Friction type distribution** and **verification method breakdown**: What goes wrong and which methods cause the most friction
- **Verification trigger analysis**: Why users encounter identity verification (onboarding, reverification, suspicious activity)
- **Platform friction leaderboard**: Top 10 platforms by discussion volume with dominant friction types
- **Signal tags**: Recurring themes extracted across thousands of IDV discussions
- **Insight cards**: Three key patterns shaping the IDV landscape
- **Biometric verification callout**: Liveness detection and facial verification analysis

### Fraud Landscape Tab

Maps the fraud landscape by type, industry, channel, and financial impact.

- **KPI strip**: Total posts, top fraud type, top industry, top channel
- **Fraud type distribution**: How different fraud types compare in volume
- **Industry breakdown** and **Fraud Type x Industry heatmap**: Where specific fraud types concentrate
- **Attack channels and financial impact**: How fraud reaches victims and the loss amounts discussed
- **Signal tags**: Recurring themes extracted across thousands of fraud discussions
- **Insight cards**: Three patterns shaping the fraud landscape
- **Financial impact callout**: Loss bracket analysis

### Interactive Features

- **Drill-downs**: Click any chart element to open a detail panel with sub-distributions, related tags, notable quotes, and individual Reddit posts
- **Post viewer**: Browse classified Reddit posts with titles, bodies, top community responses, and all classification fields
- **Cross-tab navigation**: Bridge sections connect fraud findings to IDV implications and vice versa
- **Pipeline modal**: Flowchart visualization of the full data pipeline with collection strategy details

## Tech Stack

### Dashboard
- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS v4 with custom design tokens
- **Charts:** Recharts
- **Database Client:** @neondatabase/serverless
- **Icons:** Lucide React
- **Deployment:** Docker on Railway

### Data Pipeline
- **Language:** Python 3.11+
- **Database:** Neon PostgreSQL (serverless)
- **Pass 1 LLM:** OpenAI GPT-OSS-120B (boolean routing)
- **Pass 2 LLM:** DeepSeek v3.2 (deep classification with Pydantic validation)
- **Data Source:** Reddit public `.json` endpoints (no API key required)

## Schema Overview

**`raw_posts`**: Reddit posts with Pass 1 routing flags (`is_fraud`, `is_idv`)

**`comments`**: Top 5 comments per relevant post (used as context for Pass 2)

**`fraud_classifications`**: Deep classification with `fraud_type`, `industry`, `loss_bracket`, `channel`, `notable_quote`, `tags`

**`idv_classifications`**: Deep classification with `verification_type`, `friction_type`, `trigger_reason`, `platform_name`, `sentiment`, `notable_quote`, `tags`

Full schema: [`sql/schema.sql`](sql/schema.sql)

## Running the Pipeline

Every phase runs through a single CLI entry point:

```bash
python -m backend.pipeline init                    # Initialize database tables
python -m backend.pipeline collect                 # Collect posts (21-tier search strategy)
python -m backend.pipeline pre-filter              # Remove deleted/empty posts
python -m backend.pipeline refilter                # Pass 1: Boolean routing
python -m backend.pipeline comments                # Fetch top comments
python -m backend.pipeline pass2-fraud --workers 20  # Pass 2: Fraud classification
python -m backend.pipeline pass2-idv --workers 20    # Pass 2: IDV classification
python -m backend.pipeline stats                   # Full pipeline stats
```

## File Structure

```
├── app/
│   ├── page.tsx                    # Main dashboard page (server component)
│   ├── layout.tsx                  # Root layout with metadata and fonts
│   ├── globals.css                 # Tailwind v4 theme and design tokens
│   └── api/
│       ├── posts/route.ts          # API: fetch classified posts
│       └── drill-down/route.ts     # API: drill-down sub-distributions
│
├── components/
│   ├── fraud/                      # Fraud tab components
│   │   ├── fraud-tab.tsx           # Main fraud tab container
│   │   ├── fraud-type-chart.tsx    # Fraud type distribution
│   │   ├── industry-chart.tsx      # Industry breakdown
│   │   ├── fraud-industry-matrix.tsx # Fraud x Industry heatmap
│   │   ├── channel-impact-charts.tsx # Channel and loss analysis
│   │   └── ...                     # KPI strip, tags, insight cards, callout
│   │
│   ├── idv/                        # IDV tab components
│   │   ├── idv-tab.tsx             # Main IDV tab container
│   │   ├── friction-type-chart.tsx  # Friction distribution
│   │   ├── verification-bars.tsx    # Verification method breakdown
│   │   ├── platform-friction-chart.tsx # Platform friction leaderboard
│   │   └── ...                     # KPI strip, triggers, tags, insight cards
│   │
│   └── shared/                     # Shared components
│       ├── dashboard-shell.tsx     # Main layout with tab navigation
│       ├── hero-zone.tsx           # Header with dataset stats
│       ├── drill-down-panel.tsx    # Drill-down container
│       ├── posts-modal.tsx         # Post detail viewer
│       ├── pipeline-modal.tsx      # Data pipeline visualization
│       └── ...                     # Section headers, KPI cards, teasers
│
├── lib/
│   ├── db.ts                       # Database query helper
│   ├── utils.ts                    # Utility functions (clsx, tailwind-merge)
│   ├── queries/
│   │   ├── fraud.ts                # Fraud tab database queries
│   │   └── idv.ts                  # IDV tab database queries
│   └── types/
│       └── drill-down.ts           # TypeScript interfaces for drill-down data
│
├── backend/
│   ├── pipeline.py                 # CLI entry point for all pipeline phases
│   ├── reddit_collector.py         # Reddit post collection (21 tiers)
│   ├── pre_filter.py               # Pre-filter deleted/empty posts
│   ├── pass1_classifier.py         # Pass 1: Boolean classification
│   ├── pass1_idv_classifier.py     # Pass 1b: IDV-only classifier
│   ├── comment_collector.py        # Comment collection (top 5 per post)
│   ├── pass2_classifier.py         # Pass 2: Deep classification
│   ├── llm_client.py               # LLM API clients
│   ├── db.py                       # Database operations
│   └── config.py                   # Environment configuration
│
├── sql/
│   └── schema.sql                  # Database schema (source of truth)
│
├── Dockerfile                      # Production container (Node 20 Alpine)
├── package.json                    # Dashboard dependencies and scripts
├── requirements.txt                # Pipeline dependencies
├── PROCESS.md                      # Pipeline build narrative and decisions
└── PROMPT_DESIGN.md                # Prompt design and taxonomy rationale
```

## Deployment

The dashboard runs as a Docker container on Railway:

```bash
# Local development
npm run dev

# Production build
npm run build && npm start
```

The `Dockerfile` uses Node 20 Alpine, installs dependencies with `npm ci`, builds the Next.js app, and serves on port 3000.

## Documentation

- [`PROCESS.md`](PROCESS.md): How the pipeline was built, decisions made, and lessons learned
- [`PROMPT_DESIGN.md`](PROMPT_DESIGN.md): Prompt engineering decisions, taxonomy rationale, and classification accuracy
