import { query } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  const params: unknown[] = [];
  let rWhere = "";
  let cWhere = "";
  let sWhere = "";

  if (candidateId) {
    rWhere = " WHERE gr.candidate_id = $1";
    cWhere = " WHERE gc.candidate_id = $1";
    sWhere = " WHERE gs.candidate_id = $1";
    params.push(candidateId);
  }

  const [regions, cities, states] = await Promise.all([
    query(
      `SELECT c.name, c.party, gr.*
       FROM geography_by_region gr
       JOIN candidates c ON c.id = gr.candidate_id
       ${rWhere}
       ORDER BY gr.amount DESC`,
      params
    ),
    query(
      `SELECT c.name AS candidate_name, c.party, gc.*
       FROM geography_top_cities gc
       JOIN candidates c ON c.id = gc.candidate_id
       ${cWhere}
       ORDER BY gc.amount DESC
       LIMIT 50`,
      params
    ),
    query(
      `SELECT c.name AS candidate_name, c.party, gs.*
       FROM geography_top_states gs
       JOIN candidates c ON c.id = gs.candidate_id
       ${sWhere}
       ORDER BY gs.amount DESC`,
      params
    ),
  ]);

  return NextResponse.json({
    regions: regions.rows,
    cities: cities.rows,
    states: states.rows,
  });
}
