import { query } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cid = [id];

  const [
    candidate,
    summary,
    contributions,
    contributionsBySize,
    contributionsByType,
    spending,
    spendingByCategory,
    vendors,
    debts,
    creditors,
    lenders,
    geography,
    geoRegions,
    geoCities,
    geoStates,
    donors,
    lateContributions,
    lateByState,
    lateByOccupation,
    filings,
    timeline,
    intel,
  ] = await Promise.all([
    query(`SELECT * FROM candidates WHERE id = $1`, cid),
    query(`SELECT * FROM campaign_summary WHERE candidate_id = $1`, cid),
    query(`SELECT * FROM contributions WHERE candidate_id = $1`, cid),
    query(`SELECT * FROM contributions_by_size WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM contributions_by_type WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM spending WHERE candidate_id = $1`, cid),
    query(`SELECT * FROM spending_by_category WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM top_vendors WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM debts WHERE candidate_id = $1`, cid),
    query(`SELECT * FROM top_creditors WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM top_lenders WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM geography WHERE candidate_id = $1`, cid),
    query(`SELECT * FROM geography_by_region WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM geography_top_cities WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM geography_top_states WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM top_donors WHERE candidate_id = $1 ORDER BY amount DESC LIMIT 50`, cid),
    query(`SELECT * FROM late_contributions WHERE candidate_id = $1`, cid),
    query(`SELECT * FROM late_contribution_by_state WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM late_contribution_by_occupation WHERE candidate_id = $1 ORDER BY amount DESC`, cid),
    query(`SELECT * FROM campaign_filings WHERE candidate_id = $1 ORDER BY rpt_date DESC`, cid),
    query(`SELECT * FROM campaign_timeline WHERE candidate_id = $1 ORDER BY month`, cid),
    query(`SELECT * FROM intel_snapshots WHERE candidate_id = $1`, cid),
  ]);

  if (candidate.rows.length === 0) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  return NextResponse.json({
    candidate: candidate.rows[0],
    summary: summary.rows[0] || null,
    contributions: contributions.rows[0] || null,
    contributions_by_size: contributionsBySize.rows,
    contributions_by_type: contributionsByType.rows,
    spending: spending.rows[0] || null,
    spending_by_category: spendingByCategory.rows,
    top_vendors: vendors.rows,
    debts: debts.rows[0] || null,
    top_creditors: creditors.rows,
    top_lenders: lenders.rows,
    geography: geography.rows[0] || null,
    geography_regions: geoRegions.rows,
    geography_cities: geoCities.rows,
    geography_states: geoStates.rows,
    top_donors: donors.rows,
    late_contributions: lateContributions.rows[0] || null,
    late_by_state: lateByState.rows,
    late_by_occupation: lateByOccupation.rows,
    filings: filings.rows,
    timeline: timeline.rows,
    intel: intel.rows[0] || null,
  });
}
