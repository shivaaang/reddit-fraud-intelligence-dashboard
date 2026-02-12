"""Pipeline orchestrator — run individual phases or the full pipeline."""

import argparse
from backend.db import init_schema, get_collection_stats
from backend.reddit_collector import (
    collect_all, collect_tier1, collect_tier2, collect_tier3,
    collect_tier4, collect_tier5, collect_tier6, collect_tier7, collect_tier8,
    collect_tier9, collect_tier10, collect_tier11, collect_tier12,
)
from backend.pre_filter import run_pre_filter
from backend.pass1_classifier import run_refilter
from backend.comment_collector import run_comment_collection
from backend.pass2_classifier import run_continuous
from backend.utils import setup_logger

log = setup_logger("pipeline")


def print_stats():
    stats = get_collection_stats()
    log.info("=" * 60)
    log.info("PIPELINE STATS")
    log.info(f"  Total posts:           {stats['total_posts']}")
    log.info(f"  Pre-filtered out:      {stats['pre_filtered_posts']}")
    log.info(f"  --- Pass 1 (Refilter) ---")
    log.info(f"  Refiltered:            {stats['refiltered_posts']}")
    log.info(f"  Awaiting refilter:     {stats['unrefiltered_posts']}")
    log.info(f"  Fraud (is_fraud):      {stats['fraud_posts']}")
    log.info(f"  IDV (is_idv):          {stats['idv_posts']}")
    log.info(f"  Both:                  {stats['both_posts']}")
    log.info(f"  Neither:               {stats['neither_posts']}")
    log.info(f"  --- Comments ---")
    log.info(f"  Comments fetched:      {stats['comments_fetched_posts']}")
    log.info(f"  --- Pass 2 (Classification) ---")
    log.info(f"  Fraud classified:      {stats['fraud_classified']}")
    log.info(f"  IDV classified:        {stats['idv_classified']}")
    log.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Fraud Dashboard Data Pipeline")
    parser.add_argument(
        "phase",
        choices=[
            "init", "collect",
            "collect-tier1", "collect-tier2", "collect-tier3",
            "collect-tier4", "collect-tier5", "collect-tier6",
            "collect-tier7", "collect-tier8",
            "collect-tier9", "collect-tier10", "collect-tier11", "collect-tier12",
            "pre-filter", "refilter", "refilter-sample", "comments",
            "pass2-fraud", "pass2-idv", "stats",
        ],
        help="Which phase to run",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=1000,
        help="Number of random posts for refilter-sample (default: 1000)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=20,
        help="Concurrent workers for pass2 classification (default: 20)",
    )
    args = parser.parse_args()

    if args.phase == "init":
        log.info("Initializing database schema...")
        init_schema()
        log.info("Schema initialized.")

    elif args.phase == "collect":
        collect_all()

    elif args.phase.startswith("collect-tier"):
        tier_num = args.phase.replace("collect-tier", "")
        tier_funcs = {
            "1": collect_tier1, "2": collect_tier2, "3": collect_tier3,
            "4": collect_tier4, "5": collect_tier5, "6": collect_tier6,
            "7": collect_tier7, "8": collect_tier8, "9": collect_tier9,
            "10": collect_tier10, "11": collect_tier11, "12": collect_tier12,
        }
        tier_funcs[tier_num]()

    elif args.phase == "pre-filter":
        run_pre_filter()

    elif args.phase == "refilter":
        run_refilter()

    elif args.phase == "refilter-sample":
        run_refilter(sample_size=args.sample_size)

    elif args.phase == "comments":
        run_comment_collection()

    elif args.phase == "pass2-fraud":
        log.info(f"Starting Pass 2 fraud classification ({args.workers} workers)...")
        run_continuous("fraud", workers=args.workers, reasoning="low")

    elif args.phase == "pass2-idv":
        log.info(f"Starting Pass 2 IDV classification ({args.workers} workers)...")
        run_continuous("idv", workers=args.workers, reasoning=None)

    elif args.phase == "stats":
        print_stats()


if __name__ == "__main__":
    main()
