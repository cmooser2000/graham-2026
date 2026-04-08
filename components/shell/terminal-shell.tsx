"use client";

import { ReactNode } from "react";
import { NavTabs } from "./nav-tabs";
import { StatusBar } from "./status-bar";

export function TerminalShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-dvh bg-terminal-bg relative scanlines">
      <StatusBar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      <NavTabs />
    </div>
  );
}
