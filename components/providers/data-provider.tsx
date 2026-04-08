"use client";

import { ReactNode, useMemo } from "react";
import { DataSourceContext } from "@/lib/data/hooks";
import { createPostgresProvider } from "@/lib/data/postgres-provider";

export function DataProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo(() => createPostgresProvider(), []);
  return (
    <DataSourceContext.Provider value={adapter}>
      {children}
    </DataSourceContext.Provider>
  );
}
