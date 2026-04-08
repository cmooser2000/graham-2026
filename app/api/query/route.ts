import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import { join } from "path";

function loadContext(): string {
  const files = [
    "campaign-summary.json",
    "polls.json",
    "campaign-spending.json",
    "campaign-geography.json",
    "independent-expenditures.json",
    "campaign-filings.json",
    "campaign-timeline.json",
    "intel-analysis.json",
    "social-stats.json",
  ];

  const parts: string[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(join(process.cwd(), "data", f), "utf-8");
      const data = JSON.parse(raw);
      parts.push(`## ${f}\n${JSON.stringify(data, null, 2)}`);
    } catch { /* skip */ }
  }
  return parts.join("\n\n");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const question = body.question;

  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured — add it in Vercel Environment Variables" },
      { status: 500 }
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const context = loadContext();

    const prompt = `You are a political data analyst for the Graham Platner 2026 Maine U.S. Senate campaign dashboard. Answer the user's question using the data provided below.

Be concise and direct. Use specific numbers. Bold (**text**) candidate names and key figures. If the data doesn't contain what's needed, say so honestly.

DATA:
${context}

QUESTION: ${question}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({
      type: "data",
      question,
      answer: text,
      source: "Gemini 1.5 Flash + FEC/polling data",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
