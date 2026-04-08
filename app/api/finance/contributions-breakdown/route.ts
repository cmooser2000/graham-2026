import { query } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  const params: unknown[] = [];
  let where = "";

  if (candidateId) {
    where = " WHERE bs.candidate_id = $1";
    params.push(candidateId);
  }

  const [bySize, byType] = await Promise.all([
    query(
      `SELECT c.name, c.party, bs.*
       FROM contributions_by_size bs
       JOIN candidates c ON c.id = bs.candidate_id
       ${where}
       ORDER BY c.name, bs.amount DESC`,
      params
    ),
    query(
      `SELECT c.name, c.party, bt.*
       FROM contributions_by_type bt
       JOIN candidates c ON c.id = bt.candidate_id
       ${where.replace("bs.", "bt.")}
       ORDER BY c.name, bt.amount DESC`,
      params
    ),
  ]);

  return NextResponse.json({
    by_size: bySize.rows,
    by_type: byType.rows,
  });
}
