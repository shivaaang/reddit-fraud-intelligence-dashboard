"""Pass 2 Spot Testing: Extract samples and generate accuracy reports.

The actual evaluation is done by Claude Opus agent teams, not this script.

Usage:
    python -m backend.eval_pass2 extract     # Extract 1000 fraud + 1000 IDV, split into batches
    python -m backend.eval_pass2 report      # Generate accuracy report from agent results
    python -m backend.eval_pass2 progress    # Check how many batches are complete
"""

import json
import sys
import os
from datetime import datetime

import psycopg2
from psycopg2 import extras

from backend.config import DATABASE_URL

# ============================================================
# Configuration
# ============================================================

EVAL_DIR = "eval_results"
BATCH_DIR = os.path.join(EVAL_DIR, "batches")
RESULTS_DIR = os.path.join(EVAL_DIR, "results")
BATCH_SIZE = 50

# Fields to compare for each track
FRAUD_FIELDS = ["is_relevant", "fraud_type", "industry", "loss_bracket", "channel"]
IDV_FIELDS = ["is_relevant", "verification_type", "friction_type", "trigger_reason", "platform_name", "sentiment"]


# ============================================================
# Data Extraction
# ============================================================

def extract_samples():
    """Pull 1000 random fraud + 1000 random IDV posts from DB, split into batches."""
    os.makedirs(BATCH_DIR, exist_ok=True)
    os.makedirs(RESULTS_DIR, exist_ok=True)
    conn = psycopg2.connect(DATABASE_URL)

    for track in ["fraud", "idv"]:
        print(f"\nExtracting {track} sample...")

        if track == "fraud":
            post_query = """
                SELECT rp.post_id, rp.title, rp.selftext, rp.subreddit, rp.score,
                       fc.is_relevant, fc.fraud_type, fc.industry, fc.loss_bracket,
                       fc.channel, fc.tags::text as tags_json
                FROM fraud_classifications fc
                JOIN raw_posts rp ON fc.post_id = rp.post_id
                ORDER BY RANDOM()
                LIMIT 1000
            """
        else:
            post_query = """
                SELECT rp.post_id, rp.title, rp.selftext, rp.subreddit, rp.score,
                       ic.is_relevant, ic.verification_type, ic.friction_type,
                       ic.trigger_reason, ic.platform_name, ic.sentiment,
                       ic.tags::text as tags_json
                FROM idv_classifications ic
                JOIN raw_posts rp ON ic.post_id = rp.post_id
                ORDER BY RANDOM()
                LIMIT 1000
            """

        cur = conn.cursor(cursor_factory=extras.RealDictCursor)
        cur.execute(post_query)
        posts = [dict(row) for row in cur.fetchall()]
        post_ids = [p["post_id"] for p in posts]
        print(f"  Got {len(posts)} posts")

        # Fetch comments for all posts in one query
        cur.execute("""
            SELECT post_id, body, author, score, is_submitter
            FROM comments
            WHERE post_id = ANY(%s)
            ORDER BY post_id, score DESC
        """, (post_ids,))
        all_comments = cur.fetchall()
        cur.close()

        # Group comments by post_id (limit 5 per post)
        comments_by_post = {}
        for c in all_comments:
            pid = c["post_id"]
            if pid not in comments_by_post:
                comments_by_post[pid] = []
            if len(comments_by_post[pid]) < 5:
                comments_by_post[pid].append(dict(c))

        # Attach comments and parse tags
        for post in posts:
            post["comments"] = comments_by_post.get(post["post_id"], [])
            if post.get("tags_json"):
                try:
                    post["tags"] = json.loads(post["tags_json"])
                except (json.JSONDecodeError, TypeError):
                    post["tags"] = []
            else:
                post["tags"] = []
            post.pop("tags_json", None)

        # Split into batches and save
        num_batches = (len(posts) + BATCH_SIZE - 1) // BATCH_SIZE
        for i in range(num_batches):
            batch = posts[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
            batch_path = os.path.join(BATCH_DIR, f"{track}_batch_{i+1:02d}.json")
            with open(batch_path, "w") as f:
                json.dump(batch, f, default=str, indent=2)

        print(f"  Saved {num_batches} batches to {BATCH_DIR}/{track}_batch_*.json")

    conn.close()
    print("\nExtraction complete.")


# ============================================================
# Progress Check
# ============================================================

def check_progress():
    """Check how many batch result files exist."""
    for track in ["fraud", "idv"]:
        batch_files = sorted([
            f for f in os.listdir(BATCH_DIR)
            if f.startswith(f"{track}_batch_") and f.endswith(".json")
        ]) if os.path.exists(BATCH_DIR) else []

        result_files = sorted([
            f for f in os.listdir(RESULTS_DIR)
            if f.startswith(f"{track}_batch_") and f.endswith("_results.json")
        ]) if os.path.exists(RESULTS_DIR) else []

        print(f"\n{track.upper()}: {len(result_files)}/{len(batch_files)} batches complete")

        # Count total posts evaluated
        total_posts = 0
        total_errors = 0
        for rf in result_files:
            with open(os.path.join(RESULTS_DIR, rf)) as f:
                data = json.load(f)
                total_posts += len(data)
                total_errors += sum(1 for r in data if "error" in r)

        print(f"  Posts evaluated: {total_posts}, errors: {total_errors}")


# ============================================================
# Reporting
# ============================================================

def normalize_value(val):
    """Normalize a field value for comparison."""
    if val is None:
        return "null"
    if isinstance(val, bool):
        return str(val).lower()
    if isinstance(val, str):
        return val.strip().lower().replace(" ", "_").replace("-", "_")
    return str(val).lower()


def generate_report():
    """Generate accuracy report from evaluation results."""
    os.makedirs(EVAL_DIR, exist_ok=True)
    report_lines = []

    def pr(line=""):
        report_lines.append(line)
        print(line)

    pr("# Pass 2 Classification Accuracy Report")
    pr(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    pr(f"Judge model: Claude Opus 4.6")
    pr(f"Evaluation method: Independent classification with same taxonomy")
    pr()

    for track in ["fraud", "idv"]:
        # Load all result files for this track
        result_files = sorted([
            f for f in os.listdir(RESULTS_DIR)
            if f.startswith(f"{track}_batch_") and f.endswith("_results.json")
        ]) if os.path.exists(RESULTS_DIR) else []

        if not result_files:
            pr(f"No results for {track}")
            continue

        results = []
        for rf in result_files:
            with open(os.path.join(RESULTS_DIR, rf)) as f:
                results.extend(json.load(f))

        valid = [r for r in results if "error" not in r]
        error_count = len(results) - len(valid)
        fields = FRAUD_FIELDS if track == "fraud" else IDV_FIELDS

        pr(f"## {track.upper()} Classification ({len(valid)} posts, {error_count} errors)")
        pr()

        # ---- Per-field accuracy ----
        pr("### Per-Field Accuracy")
        pr()
        pr("| Field | Accuracy | Agreement | Total |")
        pr("|-------|----------|-----------|-------|")

        for field in fields:
            matches = 0
            total = 0
            for r in valid:
                orig = normalize_value(r["original"].get(field))
                judge = normalize_value(r["judge"].get(field))

                # Special handling for platform_name (freeform)
                if field == "platform_name":
                    match = orig == judge
                    if not match and orig != "null" and judge != "null":
                        match = orig in judge or judge in orig
                else:
                    match = orig == judge

                total += 1
                if match:
                    matches += 1

            accuracy = (matches / total * 100) if total > 0 else 0
            pr(f"| {field} | {accuracy:.1f}% | {matches} | {total} |")

        # Overall (all enum fields match)
        enum_only = [f for f in fields if f != "platform_name"]
        all_match = sum(
            1 for r in valid
            if all(
                normalize_value(r["original"].get(f)) == normalize_value(r["judge"].get(f))
                for f in enum_only
            )
        )
        overall = (all_match / len(valid) * 100) if valid else 0
        pr()
        pr(f"**Overall (all enum fields match): {overall:.1f}% ({all_match}/{len(valid)})**")
        pr()

        # ---- Per-value breakdown for key enum fields ----
        enum_fields = [f for f in fields if f not in ("is_relevant", "platform_name")]

        for field in enum_fields:
            pr(f"### {field} Breakdown")
            pr()

            all_values = set()
            for r in valid:
                all_values.add(normalize_value(r["original"].get(field)))
                all_values.add(normalize_value(r["judge"].get(field)))

            value_counts = {}
            for val in sorted(all_values):
                if val == "null":
                    continue
                tp = fp = fn = 0
                for r in valid:
                    orig = normalize_value(r["original"].get(field))
                    judge = normalize_value(r["judge"].get(field))
                    if orig == val and judge == val:
                        tp += 1
                    elif orig != val and judge == val:
                        fp += 1
                    elif orig == val and judge != val:
                        fn += 1
                value_counts[val] = {"tp": tp, "fp": fp, "fn": fn}

            pr("| Value | Precision | Recall | F1 | TP | FP | FN |")
            pr("|-------|-----------|--------|-----|-----|-----|-----|")

            for val in sorted(value_counts.keys()):
                c = value_counts[val]
                precision = (c["tp"] / (c["tp"] + c["fp"]) * 100) if (c["tp"] + c["fp"]) > 0 else 0
                recall = (c["tp"] / (c["tp"] + c["fn"]) * 100) if (c["tp"] + c["fn"]) > 0 else 0
                f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0
                pr(f"| {val} | {precision:.1f}% | {recall:.1f}% | {f1:.1f}% | {c['tp']} | {c['fp']} | {c['fn']} |")

            pr()

        # ---- is_relevant confusion matrix ----
        pr("### is_relevant Confusion Matrix")
        pr()
        tp = fp = fn = tn = 0
        for r in valid:
            orig = normalize_value(r["original"].get("is_relevant"))
            judge = normalize_value(r["judge"].get("is_relevant"))
            orig_bool = orig == "true"
            judge_bool = judge == "true"
            if orig_bool and judge_bool:
                tp += 1
            elif not orig_bool and judge_bool:
                fp += 1
            elif orig_bool and not judge_bool:
                fn += 1
            else:
                tn += 1

        pr("|  | Judge: Relevant | Judge: Not Relevant |")
        pr("|--|-----------------|---------------------|")
        pr(f"| **Original: Relevant** | {tp} (TP) | {fn} (FN) |")
        pr(f"| **Original: Not Relevant** | {fp} (FP) | {tn} (TN) |")
        pr()

        rel_precision = (tp / (tp + fp) * 100) if (tp + fp) > 0 else 0
        rel_recall = (tp / (tp + fn) * 100) if (tp + fn) > 0 else 0
        rel_f1 = (2 * rel_precision * rel_recall / (rel_precision + rel_recall)) if (rel_precision + rel_recall) > 0 else 0
        pr(f"Relevance: Precision {rel_precision:.1f}%, Recall {rel_recall:.1f}%, F1 {rel_f1:.1f}%")
        pr()
        pr("---")
        pr()

    # Save report
    report_path = os.path.join(EVAL_DIR, "accuracy_report.md")
    with open(report_path, "w") as f:
        f.write("\n".join(report_lines))
    print(f"\nReport saved to {report_path}")


# ============================================================
# CLI
# ============================================================

if __name__ == "__main__":
    args = sys.argv[1:]

    if not args or args[0] == "help":
        print(__doc__)
        sys.exit(0)

    cmd = args[0]

    if cmd == "extract":
        extract_samples()
    elif cmd == "report":
        generate_report()
    elif cmd == "progress":
        check_progress()
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)
