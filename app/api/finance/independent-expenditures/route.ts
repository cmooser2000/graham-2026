import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadIEFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "independent-expenditures.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({
      summary: data.summary || [],
      committees: data.committees || [],
      expenditures: data.expenditures || [],
      source: data.data_source || "data/independent-expenditures.json",
      note: data.note || null,
    });
  } catch {
    return NextResponse.json({ summary: [], committees: [], expenditures: [] });
  }
}

export async function GET() {
  return loadIEFromJson();
}
