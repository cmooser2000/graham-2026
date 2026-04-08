import { NextResponse } from "next/server";

// Itemized FEC donor data for Platner is not yet available in this version.
// FEC itemized contributions ($2.32M of $7.87M total) require downloading
// and parsing bulk FEC data files from https://www.fec.gov/data/committee/C00916437/
// The remaining $5.48M is unitemized small-dollar donations (avg $25-33, 99% under $200).
export async function GET() {
  return NextResponse.json([]);
}
