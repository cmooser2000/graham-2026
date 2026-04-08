"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { QueryInput } from "./query-input";
import { QueryResultView } from "./query-result";
import { QueryHistory } from "./query-history";
import { SuggestedQueries } from "./suggested-queries";
import { useAppStore } from "@/lib/store/app-store";

export interface QueryEntry {
  question: string;
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  narrative: string;
  error?: string;
}

export function QueriesView() {
  const [current, setCurrent] = useState<QueryEntry | null>(null);
  const [history, setHistory] = useState<QueryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const narrativeRef = useRef("");

  const handleQuery = useCallback(async (question: string) => {
    setLoading(true);
    setStreaming(false);
    narrativeRef.current = "";

    // Set an initial entry immediately so the UI shows the question
    const initial: QueryEntry = {
      question,
      sql: "",
      columns: [],
      rows: [],
      rowCount: 0,
      narrative: "",
    };
    setCurrent(initial);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setLoading(false);

      if (data.error) {
        const entry: QueryEntry = { ...initial, error: data.error };
        setCurrent(entry);
        setHistory(h => [entry, ...h]);
        return;
      }

      const entry: QueryEntry = {
        ...initial,
        question: data.question || question,
        narrative: data.answer || "",
        sql: data.source || "",
        columns: [],
        rows: [],
        rowCount: 0,
      };
      setCurrent(entry);
      setHistory(h => [entry, ...h]);
    } catch {
      const entry: QueryEntry = { ...initial, error: "Request failed" };
      setCurrent(entry);
      setLoading(false);
      setStreaming(false);
    }
  }, []);

  const pendingQuery = useAppStore((s) => s.pendingQuery);
  const clearPendingQuery = useAppStore((s) => s.clearPendingQuery);

  useEffect(() => {
    if (pendingQuery) {
      handleQuery(pendingQuery);
      clearPendingQuery();
    }
  }, [pendingQuery, clearPendingQuery, handleQuery]);

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <QueryInput onSubmit={handleQuery} loading={loading} />

      {!current && !loading && (
        <SuggestedQueries onSelect={handleQuery} />
      )}

      {current && <QueryResultView entry={current} loading={loading} streaming={streaming} />}

      {history.length > 1 && (
        <QueryHistory entries={history.slice(1)} onSelect={setCurrent} />
      )}
    </div>
  );
}
