import { query } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  const params: unknown[] = [];
  let dWhere = "";
  let cWhere = "";
  let lWhere = "";

  if (candidateId) {
    dWhere = " WHERE d.candidate_id = $1";
    cWhere = " WHERE tc.candidate_id = $1";
    lWhere = " WHERE tl.candidate_id = $1";
    params.push(candidateId);
  }

  const [summary, creditors, lenders] = await Promise.all([
    query(
      `SELECT c.name, c.party, d.*
       FROM debts d
       JOIN candidates c ON c.id = d.candidate_id
       ${dWhere}
       ORDER BY d.total_debt DESC`,
      params
    ),
    query(
      `SELECT c.name AS candidate_name, c.party, tc.*
       FROM top_creditors tc
       JOIN candidates c ON c.id = tc.candidate_id
       ${cWhere}
       ORDER BY tc.amount DESC`,
      params
    ),
    query(
      `SELECT c.name AS candidate_name, c.party, tl.*
       FROM top_lenders tl
       JOIN candidates c ON c.id = tl.candidate_id
       ${lWhere}
       ORDER BY tl.amount DESC`,
      params
    ),
  ]);

  return NextResponse.json({
    summary: summary.rows,
    creditors: creditors.rows,
    lenders: lenders.rows,
  });
}
