import { query } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const overview = await query(`SELECT * FROM candidate_overview WHERE id = $1`, [id]);
  if (overview.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [spending, spendingByCat, timeline, social] = await Promise.all([
    query(`SELECT * FROM spending WHERE candidate_id = $1`, [id]),
    query(`SELECT * FROM spending_by_category WHERE candidate_id = $1 ORDER BY amount DESC`, [id]),
    query(`SELECT * FROM campaign_timeline WHERE candidate_id = $1 ORDER BY month`, [id]),
    query(`SELECT * FROM candidate_social_reach WHERE id = $1`, [id]),
  ]);

  return NextResponse.json({
    ...overview.rows[0],
    spending: spending.rows[0] || null,
    spending_by_category: spendingByCat.rows,
    timeline: timeline.rows,
    social: social.rows,
  });
}
