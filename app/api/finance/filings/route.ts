import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadFilingsFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "campaign-filings.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data.filings || data);
  } catch {
    return NextResponse.json([]);
  }
}

export async function GET() {
  return loadFilingsFromJson();
}
