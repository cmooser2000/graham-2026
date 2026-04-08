import { query } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  const params: unknown[] = [];
  let lcWhere = "";
  let stWhere = "";
  let ocWhere = "";

  if (candidateId) {
    lcWhere = " WHERE lc.candidate_id = $1";
    stWhere = " WHERE ls.candidate_id = $1";
    ocWhere = " WHERE lo.candidate_id = $1";
    params.push(candidateId);
  }

  const [summary, byState, byOccupation] = await Promise.all([
    query(
      `SELECT c.name, c.party, lc.*
       FROM late_contributions lc
       JOIN candidates c ON c.id = lc.candidate_id
       ${lcWhere}
       ORDER BY lc.total_raised DESC`,
      params
    ),
    query(
      `SELECT c.name AS candidate_name, c.party, ls.*
       FROM late_contribution_by_state ls
       JOIN candidates c ON c.id = ls.candidate_id
       ${stWhere}
       ORDER BY ls.amount DESC`,
      params
    ),
    query(
      `SELECT c.name AS candidate_name, c.party, lo.*
       FROM late_contribution_by_occupation lo
       JOIN candidates c ON c.id = lo.candidate_id
       ${ocWhere}
       ORDER BY lo.amount DESC`,
      params
    ),
  ]);

  return NextResponse.json({
    summary: summary.rows,
    by_state: byState.rows,
    by_occupation: byOccupation.rows,
  });
}
