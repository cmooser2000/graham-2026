"use client";

import { useState, useRef } from "react";
import { useAppStore } from "@/lib/store/app-store";

export function CommandBar() {
  const submitQuery = useAppStore((s) => s.submitQuery);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    submitQuery(trimmed);
    setValue("");
    inputRef.current?.blur();
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 bg-terminal-panel border-t border-border">
      <span className="text-terminal-yellow font-bold text-base">&gt;_</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Ask a question about the data..."
        className="flex-1 bg-transparent text-base sm:text-terminal-base text-foreground placeholder:text-terminal-dim outline-none"
      />
    </div>
  );
}
