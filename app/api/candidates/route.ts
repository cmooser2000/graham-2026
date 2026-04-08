import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await query(`SELECT * FROM candidate_overview ORDER BY COALESCE(cash_on_hand, 0) + COALESCE(s497_total_raised, 0) DESC`);
  return NextResponse.json(result.rows);
}
