"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

const SUGGESTIONS = [
  // Finance / cash
  "Who has the most cash on hand and what's their burn rate?",
  "Which candidates are spending more than they're raising?",
  "What's the average donation size per candidate?",
  "Who raised the most money last quarter?",
  "Which candidates have the highest debt-to-cash ratio?",
  "Compare total fundraising by party affiliation",
  "Who has the fastest fundraising growth rate?",
  "Which campaigns have the lowest overhead costs?",
  "What percentage of each candidate's funds come from small donors?",
  "Who has the most unspent campaign funds?",

  // Donors
  "Top 10 donors across all candidates",
  "Compare repeat donor rates across candidates",
  "Which cities contribute the most to each candidate?",
  "Who are the top out-of-state donors?",
  "Who receives the most late S497 contributions?",
  "What's the geographic distribution of donations?",
  "How many unique donors does each candidate have?",
  "What occupations do top donors have?",
  "Compare committee vs individual donations by candidate",
  "Who gets the most donations under $200?",

  // YouTube / video
  "Which candidate gets the most YouTube engagement?",
  "Who has the most YouTube subscribers?",
  "Which candidate's YouTube videos get the most views per upload?",
  "Which YouTube videos have the most likes?",
  "Which campaign YouTube videos went viral this month?",
  "Who posts the most YouTube content?",
  "What's the average view count per YouTube video by candidate?",
  "Which candidates are growing their YouTube audience fastest?",
  "Which candidates have the highest YouTube engagement rate?",
  "How have YouTube subscriber counts changed over time?",

  // Trends / polling / web
  "Who is trending on Google this week vs last month?",
  "Which candidates had Wikipedia pageview spikes recently?",
  "Which candidates have the highest Google search interest?",
  "Which candidates are polling above their fundraising rank?",
  "What do the latest polls show?",
  "Compare Wikipedia pageview trends for top candidates",
  "Which candidates improved the most in polls this quarter?",
  "How do poll numbers compare to fundraising totals?",
  "Who are the top candidates in the latest polls?",
  "Compare Google Trends interest over the past 90 days",

  // Spending / outside money
  "Who are the top campaign vendors by spending?",
  "Which candidates spend the most on consultants?",
  "Who spends the most on travel?",
  "Compare media and advertising spend across candidates",
  "What's the breakdown of spending categories per candidate?",
  "Which candidates have filed the most campaign reports?",
  "How much outside money supports or opposes each candidate?",
  "Which independent expenditure committees spend the most?",
];

function sampleRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

interface SuggestedQueriesProps {
  onSelect: (question: string) => void;
}

export function SuggestedQueries({ onSelect }: SuggestedQueriesProps) {
  const [samples] = useState(() => sampleRandom(SUGGESTIONS, 6));

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <Sparkles size={10} className="text-terminal-yellow" />
        <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase">Suggested Queries</span>
      </div>
      <div className="flex flex-col gap-1">
        {samples.map(q => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="text-left text-terminal-sm text-terminal-cyan hover:text-terminal-yellow bg-terminal-panel border border-border rounded px-3 py-2 hover:bg-terminal-raised transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
