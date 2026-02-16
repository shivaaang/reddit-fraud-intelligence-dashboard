import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import type { DrillDownResponse } from "@/lib/types/drill-down";

const FRAUD_DIMENSIONS = ["fraud_type", "industry", "loss_bracket", "channel"];
const IDV_DIMENSIONS = [
  "verification_type",
  "friction_type",
  "trigger_reason",
  "platform_name",
  "sentiment",
];

const INITIAL_PAGE_SIZE = 5;
const LOAD_MORE_SIZE = 10;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get("type");
    const postsOffset = Math.max(0, Number(params.get("posts_offset") || "0"));

    if (!type || !["fraud", "idv"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'fraud' or 'idv'" },
        { status: 400 }
      );
    }

    const sql = neon(process.env.DATABASE_URL!);

    const classTable =
      type === "fraud" ? "fraud_classifications" : "idv_classifications";
    const allowedFilters =
      type === "fraud" ? FRAUD_DIMENSIONS : IDV_DIMENSIONS;

    // Build WHERE clause from filters
    const conditions: string[] = ["c.is_relevant = true"];
    const values: (string | number)[] = [];
    let paramIdx = 1;
    const activeFilters = new Set<string>();

    for (const key of allowedFilters) {
      const val = params.get(key);
      if (val) {
        conditions.push(`c.${key} = $${paramIdx}`);
        values.push(val);
        paramIdx++;
        activeFilters.add(key);
      }
    }

    // Tag filter uses JSONB containment
    const tag = params.get("tag");
    if (tag) {
      conditions.push(`c.tags @> $${paramIdx}::jsonb`);
      values.push(JSON.stringify([tag]));
      paramIdx++;
      activeFilters.add("tag");
    }

    const whereClause = conditions.join(" AND ");

    // Determine which dimensions to break down (skip already-filtered ones)
    const breakdownDimensions = allowedFilters.filter(
      (d) => !activeFilters.has(d)
    );

    // Posts page size: first load = 5, subsequent = 10
    const postsLimit = postsOffset === 0 ? INITIAL_PAGE_SIZE : LOAD_MORE_SIZE;

    // Query A: Total count for filtered subset
    const countQuery = `SELECT COUNT(*) as total FROM ${classTable} c WHERE ${whereClause}`;

    // Query B: Tab total (all relevant posts for this type)
    const tabTotalQuery = `SELECT COUNT(*) as total FROM ${classTable} c WHERE c.is_relevant = true`;

    // Query C: Best quote, highest score, length between 50 and 300
    const quoteQuery = `SELECT c.notable_quote as text, rp.subreddit, rp.score
      FROM ${classTable} c
      JOIN raw_posts rp ON c.post_id = rp.post_id
      WHERE ${whereClause}
        AND c.notable_quote IS NOT NULL
        AND LENGTH(c.notable_quote) > 50
        AND LENGTH(c.notable_quote) < 300
      ORDER BY rp.score DESC
      LIMIT 1`;

    // Query D: Breakdowns for each non-filtered dimension
    const breakdownQueries = breakdownDimensions.map((dim) => {
      const q = `SELECT c.${dim} as name, COUNT(*) as count
        FROM ${classTable} c
        WHERE ${whereClause} AND c.${dim} IS NOT NULL
        GROUP BY c.${dim}
        ORDER BY count DESC
        LIMIT 6`;
      return sql.query(q, values).then((rows) => ({
        dim,
        rows: rows as Record<string, unknown>[],
      }));
    });

    // Query E: Top tags (always included)
    const tagsQuery = `SELECT tag, COUNT(*) as count FROM (
      SELECT jsonb_array_elements_text(c.tags) as tag
      FROM ${classTable} c
      JOIN raw_posts rp ON c.post_id = rp.post_id
      WHERE ${whereClause}
        AND c.tags IS NOT NULL
    ) t
    GROUP BY tag ORDER BY count DESC LIMIT 12`;

    // Query F: Posts with details
    const postsQuery = `SELECT
      rp.post_id, rp.title, rp.subreddit, rp.permalink,
      rp.score, rp.num_comments, rp.created_utc,
      c.notable_quote, c.tags
      FROM ${classTable} c
      JOIN raw_posts rp ON c.post_id = rp.post_id
      WHERE ${whereClause}
      ORDER BY rp.score DESC
      LIMIT ${postsLimit}
      OFFSET ${postsOffset}`;

    // Build parallel queries
    const queries: Promise<unknown>[] = [
      sql.query(countQuery, values), // 0: count
      sql.query(tabTotalQuery), // 1: tab total
      sql.query(quoteQuery, values), // 2: quote
      ...breakdownQueries, // 3..N-3: breakdowns
      sql.query(tagsQuery, values), // N-2: tags
      sql.query(postsQuery, values), // N-1: posts
    ];

    // Query G (IDV only): Negative sentiment count
    if (type === "idv") {
      const sentimentQuery = `SELECT COUNT(*) as count
        FROM ${classTable} c
        WHERE ${whereClause} AND c.sentiment = 'negative'`;
      queries.push(sql.query(sentimentQuery, values));
    }

    const results = await Promise.all(queries);

    // Parse results
    const countResult = results[0] as Record<string, unknown>[];
    const tabTotalResult = results[1] as Record<string, unknown>[];
    const quoteResult = results[2] as Record<string, unknown>[];

    const breakdownResults = results.slice(
      3,
      3 + breakdownDimensions.length
    ) as { dim: string; rows: Record<string, unknown>[] }[];

    const tagsResult = results[3 + breakdownDimensions.length] as Record<
      string,
      unknown
    >[];
    const postsResult = results[4 + breakdownDimensions.length] as Record<
      string,
      unknown
    >[];

    const total = Number(countResult[0].total);
    const tabTotal = Number(tabTotalResult[0].total);
    const percent = tabTotal > 0 ? (total / tabTotal) * 100 : 0;

    // Build quote
    const quote =
      quoteResult.length > 0
        ? {
            text: quoteResult[0].text as string,
            subreddit: quoteResult[0].subreddit as string,
            score: Number(quoteResult[0].score),
          }
        : null;

    // Build breakdowns
    const breakdowns: Record<string, { name: string; count: number }[]> = {};
    for (const br of breakdownResults) {
      breakdowns[br.dim] = br.rows.map((r) => ({
        name: r.name as string,
        count: Number(r.count),
      }));
    }

    // Tags breakdown
    breakdowns["tags"] = (tagsResult as Record<string, unknown>[]).map((r) => ({
      name: r.tag as string,
      count: Number(r.count),
    }));

    // Posts
    const posts = (postsResult as Record<string, unknown>[]).map((r) => ({
      postId: r.post_id as string,
      title: r.title as string,
      subreddit: r.subreddit as string,
      permalink: r.permalink as string,
      score: Number(r.score),
      numComments: Number(r.num_comments),
      createdUtc: r.created_utc as string,
      notableQuote: (r.notable_quote as string) || null,
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    }));

    const response: DrillDownResponse = {
      total,
      tabTotal,
      percent,
      quote,
      breakdowns,
      posts,
      postsTotalCount: total,
    };

    // IDV: add negative sentiment percentage
    if (type === "idv") {
      const sentimentResult = results[results.length - 1] as Record<
        string,
        unknown
      >[];
      const negCount = Number(sentimentResult[0].count);
      response.sentimentPercent = total > 0 ? (negCount / total) * 100 : 0;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /api/drill-down] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch drill-down data", detail: String(error) },
      { status: 500 }
    );
  }
}
