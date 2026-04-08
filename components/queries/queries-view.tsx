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

      const reader = res.body?.getReader();
      if (!reader) {
        const entry: QueryEntry = { ...initial, error: "No response stream" };
        setCurrent(entry);
        setHistory(h => [entry, ...h]);
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let entry: QueryEntry = { ...initial };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          try {
            const evt = JSON.parse(jsonStr);

            if (evt.type === "data") {
              entry = {
                ...entry,
                question: evt.question,
                sql: evt.sql,
                columns: evt.columns,
                rows: evt.rows,
                rowCount: evt.rowCount,
              };
              setCurrent({ ...entry });
              setLoading(false);
              setStreaming(true);
            } else if (evt.type === "text") {
              narrativeRef.current += evt.content;
              entry = { ...entry, narrative: narrativeRef.current };
              setCurrent({ ...entry });
            } else if (evt.type === "done") {
              setStreaming(false);
              setHistory(h => [entry, ...h]);
            } else if (evt.type === "error") {
              entry = { ...entry, error: evt.error, sql: evt.sql || entry.sql };
              setCurrent({ ...entry });
              setHistory(h => [entry, ...h]);
              setLoading(false);
              setStreaming(false);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
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
