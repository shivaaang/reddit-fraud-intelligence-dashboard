import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get("type"); // "fraud" or "idv"
    const page = Math.max(1, Number(params.get("page") || "1"));
    const offset = (page - 1) * PAGE_SIZE;

    if (!type || !["fraud", "idv"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'fraud' or 'idv'" },
        { status: 400 }
      );
    }

    const sql = neon(process.env.DATABASE_URL!);

    const classTable =
      type === "fraud" ? "fraud_classifications" : "idv_classifications";

    // Build WHERE conditions from query params
    const conditions: string[] = [`c.is_relevant = true`];
    const values: (string | number)[] = [];
    let paramIdx = 1;

    const allowedFilters =
      type === "fraud"
        ? ["fraud_type", "industry", "loss_bracket", "channel"]
        : [
            "verification_type",
            "friction_type",
            "trigger_reason",
            "platform_name",
            "sentiment",
          ];

    for (const key of allowedFilters) {
      const val = params.get(key);
      if (val) {
        conditions.push(`c.${key} = $${paramIdx}`);
        values.push(val);
        paramIdx++;
      }
    }

    // Tag filter
    const tag = params.get("tag");
    if (tag) {
      conditions.push(`c.tags @> $${paramIdx}::jsonb`);
      values.push(JSON.stringify([tag]));
      paramIdx++;
    }

    const whereClause = conditions.join(" AND ");

    const countQuery = `SELECT COUNT(*) as total FROM ${classTable} c WHERE ${whereClause}`;
    const dataQuery = `SELECT
      rp.post_id,
      rp.title,
      rp.subreddit,
      rp.permalink,
      rp.score,
      rp.num_comments,
      rp.created_utc
    FROM ${classTable} c
    JOIN raw_posts rp ON c.post_id = rp.post_id
    WHERE ${whereClause}
    ORDER BY rp.score DESC
    LIMIT ${PAGE_SIZE}
    OFFSET ${offset}`;

    const [countResult, dataResult] = await Promise.all([
      sql.query(countQuery, values),
      sql.query(dataQuery, values),
    ]);

    const total = Number(countResult[0].total);

    return NextResponse.json({
      posts: dataResult.map((r: Record<string, unknown>) => ({
        postId: r.post_id,
        title: r.title,
        subreddit: r.subreddit,
        permalink: r.permalink,
        score: r.score,
        numComments: r.num_comments,
        createdUtc: r.created_utc,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (error) {
    console.error("[API /api/posts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts", detail: String(error) },
      { status: 500 }
    );
  }
}
