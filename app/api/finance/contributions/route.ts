import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await query(`
    SELECT c.name, c.party, co.*
    FROM contributions co
    JOIN candidates c ON c.id = co.candidate_id
    ORDER BY co.total_raised DESC
  `);
  return NextResponse.json(result.rows);
}
