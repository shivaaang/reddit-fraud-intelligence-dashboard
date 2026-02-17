import { getDb } from "@/lib/db";

// ── KPI queries ──────────────────────────────────────────────

export async function getIdvKPIs() {
  const sql = getDb();

  const [totalRow] = await sql`
    SELECT COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
  `;

  const [topFriction] = await sql`
    SELECT friction_type, COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
      AND friction_type NOT IN ('other', 'none')
    GROUP BY friction_type
    ORDER BY count DESC
    LIMIT 1
  `;

  const [negSentiment] = await sql`
    SELECT COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
      AND sentiment IN ('negative')
  `;

  const [topPlatform] = await sql`
    SELECT platform_name, COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
      AND platform_name IS NOT NULL
    GROUP BY platform_name
    ORDER BY count DESC
    LIMIT 1
  `;

  const total = Number(totalRow.count);
  const negCount = Number(negSentiment.count);

  return {
    totalPosts: total,
    topFrictionType: topFriction.friction_type as string,
    topFrictionCount: Number(topFriction.count),
    negativeSentimentPercent: total > 0 ? (negCount / total) * 100 : 0,
    topPlatform: (topPlatform.platform_name as string) || "Unknown",
    topPlatformCount: Number(topPlatform.count),
  };
}

// ── Friction Type Distribution ───────────────────────────────

export async function getFrictionTypeDistribution() {
  const sql = getDb();

  const rows = await sql`
    SELECT friction_type, COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
    GROUP BY friction_type
    ORDER BY count DESC
  `;

  return rows.map((r) => ({
    name: r.friction_type as string,
    count: Number(r.count),
  }));
}

// ── Verification Type Distribution ───────────────────────────

export async function getVerificationTypeDistribution() {
  const sql = getDb();

  const rows = await sql`
    SELECT verification_type, COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
    GROUP BY verification_type
    ORDER BY count DESC
  `;

  return rows.map((r) => ({
    name: r.verification_type as string,
    count: Number(r.count),
  }));
}

// ── Platform Friction Intelligence ───────────────────────────

export async function getPlatformFriction() {
  const sql = getDb();

  const rows = await sql`
    WITH platform_counts AS (
      SELECT platform_name, COUNT(*) as total
      FROM idv_classifications
      WHERE is_relevant = true AND platform_name IS NOT NULL
      GROUP BY platform_name
      ORDER BY total DESC
      LIMIT 10
    ),
    platform_top_friction AS (
      SELECT DISTINCT ON (ic.platform_name)
        ic.platform_name,
        ic.friction_type,
        COUNT(*) as friction_count
      FROM idv_classifications ic
      WHERE ic.is_relevant = true
        AND ic.platform_name IN (SELECT platform_name FROM platform_counts)
      GROUP BY ic.platform_name, ic.friction_type
      ORDER BY ic.platform_name, friction_count DESC
    )
    SELECT pc.platform_name, pc.total, ptf.friction_type as top_friction
    FROM platform_counts pc
    JOIN platform_top_friction ptf ON pc.platform_name = ptf.platform_name
    ORDER BY pc.total DESC
  `;

  return rows.map((r) => ({
    platform: r.platform_name as string,
    count: Number(r.total),
    topFriction: r.top_friction as string,
  }));
}

// ── Trigger Reason Distribution ──────────────────────────────

export async function getTriggerReasonDistribution() {
  const sql = getDb();

  const rows = await sql`
    SELECT trigger_reason, COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
      AND trigger_reason IS NOT NULL
    GROUP BY trigger_reason
    ORDER BY count DESC
  `;

  return rows.map((r) => ({
    name: r.trigger_reason as string,
    count: Number(r.count),
  }));
}

// ── IDV Tags ─────────────────────────────────────────────────

export async function getIdvTags() {
  const sql = getDb();

  const rows = await sql`
    SELECT tag, COUNT(*) as count
    FROM (
      SELECT jsonb_array_elements_text(tags) as tag
      FROM idv_classifications
      WHERE is_relevant = true AND tags IS NOT NULL
    ) t
    GROUP BY tag
    ORDER BY count DESC
    LIMIT 50
  `;

  return rows.map((r) => ({
    tag: r.tag as string,
    count: Number(r.count),
  }));
}

// ── Hero Zone Stats ─────────────────────────────────────────

export async function getIdvHeroStats() {
  const sql = getDb();

  const topSubreddits = await sql`
    SELECT rp.subreddit, COUNT(*) as count
    FROM idv_classifications ic
    JOIN raw_posts rp ON ic.post_id = rp.post_id
    WHERE ic.is_relevant = true
    GROUP BY rp.subreddit
    ORDER BY count DESC
    LIMIT 6
  `;

  return {
    topSubreddits: topSubreddits.map((r) => ({
      name: r.subreddit as string,
      count: Number(r.count),
    })),
  };
}

// ── Insight Story Card Data ──────────────────────────────────

export async function getIdvInsightData() {
  const sql = getDb();

  // Age verification count
  const [ageRow] = await sql`
    SELECT COUNT(DISTINCT ic.post_id) as count
    FROM idv_classifications ic,
    LATERAL jsonb_array_elements_text(ic.tags) as tag
    WHERE ic.is_relevant = true
      AND ((tag ILIKE 'age%' OR tag ILIKE '%_age' OR tag ILIKE '%_age_%' OR tag ILIKE '%age_%' OR tag = 'underage' OR tag ILIKE '%underage%') OR ic.trigger_reason = 'age_gate')
  `;

  // Gig worker count
  const [gigRow] = await sql`
    SELECT COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
      AND platform_name IN ('Uber', 'Lyft', 'DoorDash', 'Instacart', 'Grubhub', 'Amazon Flex', 'Shipt')
  `;

  // False rejection stats
  const [frRow] = await sql`
    SELECT COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true AND friction_type = 'false_rejection'
  `;

  const [totalRow] = await sql`
    SELECT COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
  `;

  // Liveness/biometric mentions, overall and by type
  const [livenessRow] = await sql`
    SELECT COUNT(DISTINCT ic.post_id) as count
    FROM idv_classifications ic
    WHERE ic.is_relevant = true
      AND (ic.verification_type IN ('liveness_check', 'facial_age_estimation')
           OR ic.verification_type = 'selfie_photo')
  `;

  const biometricBreakdown = await sql`
    SELECT verification_type, COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true
      AND verification_type IN ('selfie_photo', 'liveness_check', 'facial_age_estimation')
    GROUP BY verification_type
    ORDER BY count DESC
  `;

  // Privacy concern count
  const [privacyRow] = await sql`
    SELECT COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true AND friction_type = 'privacy_concern'
  `;

  // No alternative method count
  const [noAltRow] = await sql`
    SELECT COUNT(*) as count
    FROM idv_classifications
    WHERE is_relevant = true AND friction_type = 'no_alternative_method'
  `;

  const total = Number(totalRow.count);

  return {
    ageVerificationCount: Number(ageRow.count),
    gigWorkerCount: Number(gigRow.count),
    falseRejectionCount: Number(frRow.count),
    falseRejectionPercent: total > 0 ? (Number(frRow.count) / total) * 100 : 0,
    livenessCount: Number(livenessRow.count),
    biometricBreakdown: biometricBreakdown.map((r) => ({
      type: r.verification_type as string,
      count: Number(r.count),
    })),
    privacyConcernCount: Number(privacyRow.count),
    privacyConcernPercent: total > 0 ? (Number(privacyRow.count) / total) * 100 : 0,
    noAlternativeCount: Number(noAltRow.count),
    total,
  };
}
