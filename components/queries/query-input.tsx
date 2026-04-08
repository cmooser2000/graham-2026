"use client";

import { useState, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";

interface QueryInputProps {
  onSubmit: (question: string) => void;
  loading: boolean;
}

export function QueryInput({ onSubmit, loading }: QueryInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    if (!value.trim() || loading) return;
    onSubmit(value.trim());
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex items-center gap-2 bg-terminal-raised border border-border rounded px-3 py-2 min-h-[44px]">
      <span className="text-terminal-yellow font-bold text-base shrink-0">&gt;</span>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about the race data..."
        className="flex-1 bg-transparent text-terminal-sm outline-none placeholder:text-terminal-muted"
        disabled={loading}
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim() || loading}
        className="text-terminal-yellow hover:glow-yellow disabled:text-terminal-muted disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      </button>
    </div>
  );
}
