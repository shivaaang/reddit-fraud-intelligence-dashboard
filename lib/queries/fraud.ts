import { getDb } from "@/lib/db";

// ── KPI queries ──────────────────────────────────────────────

export async function getFraudKPIs() {
  const sql = getDb();

  const [totalRow] = await sql`
    SELECT COUNT(*) as count
    FROM fraud_classifications
    WHERE is_relevant = true
  `;

  const [topFraudType] = await sql`
    SELECT fraud_type, COUNT(*) as count
    FROM fraud_classifications
    WHERE is_relevant = true
      AND fraud_type != 'other'
    GROUP BY fraud_type
    ORDER BY count DESC
    LIMIT 1
  `;

  const [topIndustry] = await sql`
    SELECT industry, COUNT(*) as count
    FROM fraud_classifications
    WHERE is_relevant = true
      AND industry != 'other'
    GROUP BY industry
    ORDER BY count DESC
    LIMIT 1
  `;

  const [topChannel] = await sql`
    SELECT channel, COUNT(*) as count
    FROM fraud_classifications
    WHERE is_relevant = true
      AND channel != 'other'
    GROUP BY channel
    ORDER BY count DESC
    LIMIT 1
  `;

  return {
    totalPosts: Number(totalRow.count),
    topFraudType: topFraudType.fraud_type as string,
    topFraudTypeCount: Number(topFraudType.count),
    topIndustry: topIndustry.industry as string,
    topIndustryCount: Number(topIndustry.count),
    topChannel: topChannel.channel as string,
    topChannelCount: Number(topChannel.count),
  };
}

// ── Fraud Type Distribution ──────────────────────────────────

export async function getFraudTypeDistribution() {
  const sql = getDb();

  const rows = await sql`
    SELECT fraud_type, COUNT(*) as count
    FROM fraud_classifications
    WHERE is_relevant = true
    GROUP BY fraud_type
    ORDER BY count DESC
  `;

  return rows.map((r) => ({
    name: r.fraud_type as string,
    count: Number(r.count),
  }));
}

// ── Industry Breakdown ───────────────────────────────────────

export async function getIndustryBreakdown() {
  const sql = getDb();

  const rows = await sql`
    SELECT industry, COUNT(*) as count
    FROM fraud_classifications
    WHERE is_relevant = true
    GROUP BY industry
    ORDER BY count DESC
    LIMIT 8
  `;

  return rows.map((r) => ({
    name: r.industry as string,
    count: Number(r.count),
  }));
}

// ── Fraud × Industry Matrix ─────────────────────────────────

export async function getFraudIndustryMatrix() {
  const sql = getDb();

  const rows = await sql`
    WITH top_fraud AS (
      SELECT fraud_type
      FROM fraud_classifications
      WHERE is_relevant = true
        AND fraud_type != 'other'
      GROUP BY fraud_type
      ORDER BY COUNT(*) DESC
      LIMIT 6
    ),
    top_industry AS (
      SELECT industry
      FROM fraud_classifications
      WHERE is_relevant = true
        AND industry != 'other'
      GROUP BY industry
      ORDER BY COUNT(*) DESC
      LIMIT 6
    )
    SELECT fc.fraud_type, fc.industry, COUNT(*) as count
    FROM fraud_classifications fc
    WHERE fc.is_relevant = true
      AND fc.fraud_type IN (SELECT fraud_type FROM top_fraud)
      AND fc.industry IN (SELECT industry FROM top_industry)
    GROUP BY fc.fraud_type, fc.industry
    ORDER BY fc.fraud_type, fc.industry
  `;

  // Get the ordered lists for axes
  const fraudTypes = await sql`
    SELECT fraud_type FROM fraud_classifications
    WHERE is_relevant = true AND fraud_type != 'other'
    GROUP BY fraud_type ORDER BY COUNT(*) DESC LIMIT 6
  `;
  const industries = await sql`
    SELECT industry FROM fraud_classifications
    WHERE is_relevant = true AND industry != 'other'
    GROUP BY industry ORDER BY COUNT(*) DESC LIMIT 6
  `;

  // Build matrix lookup
  const matrix: Record<string, Record<string, number>> = {};
  let maxCount = 0;
  for (const row of rows) {
    const ft = row.fraud_type as string;
    const ind = row.industry as string;
    const count = Number(row.count);
    if (!matrix[ft]) matrix[ft] = {};
    matrix[ft][ind] = count;
    if (count > maxCount) maxCount = count;
  }

  return {
    fraudTypes: fraudTypes.map((r) => r.fraud_type as string),
    industries: industries.map((r) => r.industry as string),
    matrix,
    maxCount,
  };
}

// ── Channel (Digital Attack Surface) ─────────────────────────

export async function getChannelDistribution() {
  const sql = getDb();

  const rows = await sql`
    SELECT channel, COUNT(*) as count
    FROM fraud_classifications
    WHERE is_relevant = true
    GROUP BY channel
    ORDER BY count DESC
  `;

  return rows.map((r) => ({
    name: r.channel as string,
    count: Number(r.count),
  }));
}

// ── Loss Bracket (Financial Impact) ──────────────────────────

export async function getLossBracketDistribution() {
  const sql = getDb();

  const rows = await sql`
    SELECT loss_bracket, COUNT(*) as count
    FROM fraud_classifications
    WHERE is_relevant = true
    GROUP BY loss_bracket
    ORDER BY
      CASE loss_bracket
        WHEN 'none' THEN 1
        WHEN 'under_100' THEN 2
        WHEN '100_to_1k' THEN 3
        WHEN '1k_to_10k' THEN 4
        WHEN '10k_to_100k' THEN 5
        WHEN 'over_100k' THEN 6
        WHEN 'unspecified' THEN 7
      END
  `;

  return rows.map((r) => ({
    name: r.loss_bracket as string,
    count: Number(r.count),
  }));
}

// ── Tags ─────────────────────────────────────────────────────

export async function getFraudTags() {
  const sql = getDb();

  const rows = await sql`
    SELECT tag, COUNT(*) as count
    FROM (
      SELECT jsonb_array_elements_text(tags) as tag
      FROM fraud_classifications
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

export async function getFraudHeroStats() {
  const sql = getDb();

  const topSubreddits = await sql`
    SELECT rp.subreddit, COUNT(*) as count
    FROM fraud_classifications fc
    JOIN raw_posts rp ON fc.post_id = rp.post_id
    WHERE fc.is_relevant = true
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

// ── AI/Deepfake tag count (for insight card) ─────────────────

export async function getAiThreatCount() {
  const sql = getDb();

  const [row] = await sql`
    SELECT COUNT(*) as count FROM (
      SELECT DISTINCT fc.post_id
      FROM fraud_classifications fc
      LEFT JOIN LATERAL jsonb_array_elements_text(fc.tags) as tag ON true
      WHERE fc.is_relevant = true
        AND (fc.fraud_type = 'deepfake_ai'
             OR tag IN ('deepfake', 'ai_generated', 'ai_voice', 'ai_scam', 'voice_cloning', 'synthetic_identity'))
    ) sub
  `;

  return Number(row.count);
}

// ── Insight Cards Data ──────────────────────────────────────

export async function getFraudInsightData() {
  const sql = getDb();

  // Recovery void: posts about failed recovery, no recourse, support failures
  const [recoveryRow] = await sql`
    SELECT COUNT(DISTINCT fc.post_id) as count
    FROM fraud_classifications fc,
    LATERAL jsonb_array_elements_text(fc.tags) as tag
    WHERE fc.is_relevant = true
      AND tag IN ('no_recourse', 'support_failure', 'chargeback', 'recovery', 'bank_refused', 'frozen_account', 'account_locked', 'customer_support', 'refund', 'dispute', 'bank_response', 'platform_response', 'negligence', 'complaint')
  `;

  // Social engineering: phishing, romance scams, manipulation-based fraud
  const [socialEngRow] = await sql`
    SELECT COUNT(DISTINCT fc.post_id) as count
    FROM fraud_classifications fc
    WHERE fc.is_relevant = true
      AND (fc.fraud_type IN ('social_engineering', 'romance_scam', 'phishing')
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(fc.tags) as tag
             WHERE tag IN ('social_engineering', 'phishing', 'romance', 'pig_butchering', 'impersonation', 'catfishing', 'pretexting', 'baiting', 'vishing', 'smishing')
           ))
  `;

  // Organized crime signals: coordinated, cross-border, syndicate operations
  const [organizedRow] = await sql`
    SELECT COUNT(DISTINCT fc.post_id) as count
    FROM fraud_classifications fc,
    LATERAL jsonb_array_elements_text(fc.tags) as tag
    WHERE fc.is_relevant = true
      AND tag IN ('organized', 'sophisticated', 'cross_border', 'ring', 'coordinated', 'syndicate', 'mule', 'money_mule', 'high_volume', 'international')
  `;

  const [totalRow] = await sql`
    SELECT COUNT(*) as count
    FROM fraud_classifications
    WHERE is_relevant = true
  `;

  return {
    recoveryVoidCount: Number(recoveryRow.count),
    socialEngineeringCount: Number(socialEngRow.count),
    organizedCrimeCount: Number(organizedRow.count),
    total: Number(totalRow.count),
  };
}
