"""Pipeline orchestrator — run individual phases or the full pipeline."""

import argparse
from backend.db import init_schema, get_collection_stats
from backend.reddit_collector import (
    collect_all, collect_tier1, collect_tier2, collect_tier3,
    collect_tier4, collect_tier5, collect_tier6, collect_tier7, collect_tier8,
    collect_tier9, collect_tier10, collect_tier11, collect_tier12,
)
from backend.pre_filter import run_pre_filter
from backend.relevance_filter import run_relevance_filter
from backend.comment_collector import run_comment_collection
from backend.classifier import run_classification
from backend.utils import setup_logger

log = setup_logger("pipeline")


def print_stats():
    stats = get_collection_stats()
    log.info("=" * 60)
    log.info("COLLECTION STATS")
    log.info(f"  Total posts:           {stats['total_posts']}")
    log.info(f"  Pre-filtered out:      {stats['pre_filtered_posts']}")
    log.info(f"  Awaiting LLM filter:   {stats['unfiltered_posts']}")
    log.info(f"  Relevant:              {stats['relevant_posts']}")
    log.info(f"  Irrelevant:            {stats['irrelevant_posts']}")
    log.info(f"  Comments fetched:      {stats['comments_fetched_posts']}")
    log.info(f"  Classified:            {stats['classified_posts']}")
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
            "pre-filter", "filter", "comments", "classify", "stats", "all",
        ],
        help="Which phase to run",
    )
    parser.add_argument(
        "--no-schema",
        action="store_true",
        help="Skip structured output JSON schema (for models that don't support it)",
    )
    args = parser.parse_args()

    use_schema = not args.no_schema

    if args.phase == "init":
        log.info("Initializing database schema...")
        init_schema()
        log.info("Schema initialized.")

    elif args.phase == "collect":
        collect_all()

    elif args.phase == "collect-tier1":
        collect_tier1()

    elif args.phase == "collect-tier2":
        collect_tier2()

    elif args.phase == "collect-tier3":
        collect_tier3()

    elif args.phase == "collect-tier4":
        collect_tier4()

    elif args.phase == "collect-tier5":
        collect_tier5()

    elif args.phase == "collect-tier6":
        collect_tier6()

    elif args.phase == "collect-tier7":
        collect_tier7()

    elif args.phase == "collect-tier8":
        collect_tier8()

    elif args.phase == "collect-tier9":
        collect_tier9()

    elif args.phase == "collect-tier10":
        collect_tier10()

    elif args.phase == "collect-tier11":
        collect_tier11()

    elif args.phase == "collect-tier12":
        collect_tier12()

    elif args.phase == "pre-filter":
        run_pre_filter()

    elif args.phase == "filter":
        run_relevance_filter(use_schema=use_schema)

    elif args.phase == "comments":
        run_comment_collection()

    elif args.phase == "classify":
        run_classification(use_schema=use_schema)

    elif args.phase == "stats":
        print_stats()

    elif args.phase == "all":
        log.info("Running full pipeline...")
        init_schema()
        collect_all()
        run_pre_filter()
        print_stats()
        log.info("PAUSE: Collection complete. Review data before running LLM filter.")
        log.info("Run 'python -m backend.pipeline filter' to continue.")
        return

    print_stats()


if __name__ == "__main__":
    main()
