"use client";

import { useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useDatasets, useQuery } from "@/lib/data/hooks";
import { DataTable } from "./data-table";
import { DetailDrawer } from "./detail-drawer";
import { Input } from "@/components/ui/input";
import { DataRow, QueryParams } from "@/lib/data/types";
import { Search, Database } from "lucide-react";

export function ExplorerView() {
  const activeDatasetId = useAppStore((s) => s.activeDatasetId);
  const setActiveDatasetId = useAppStore((s) => s.setActiveDatasetId);
  const datasets = useDatasets();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | undefined>();
  const [selectedRow, setSelectedRow] = useState<DataRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const queryParams = useMemo<QueryParams>(
    () => ({
      datasetId: activeDatasetId,
      search: search || undefined,
      sort,
    }),
    [activeDatasetId, search, sort]
  );

  const { result, loading } = useQuery(queryParams);

  const handleSort = useCallback(
    (key: string) => {
      setSort((prev) => {
        if (prev?.key === key) {
          return prev.direction === "asc"
            ? { key, direction: "desc" }
            : undefined;
        }
        return { key, direction: "asc" };
      });
    },
    []
  );

  const handleRowClick = useCallback((row: DataRow) => {
    setSelectedRow(row);
    setDrawerOpen(true);
  }, []);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId);

  return (
    <div className="flex flex-col h-full">
      {/* Dataset selector */}
      <div className="flex gap-1 px-3 pt-3 pb-2 overflow-x-auto">
        {datasets.map((ds) => (
          <button
            key={ds.id}
            onClick={() => { setActiveDatasetId(ds.id); setSearch(""); setSort(undefined); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-terminal-sm whitespace-nowrap transition-colors ${
              ds.id === activeDatasetId
                ? "bg-terminal-raised text-terminal-yellow border border-terminal-yellow/30"
                : "bg-terminal-panel text-terminal-dim border border-border hover:text-foreground"
            }`}
          >
            <Database size={10} />
            {ds.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-terminal-dim" size={12} />
          <Input
            placeholder="Filter rows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-terminal-sm bg-terminal-raised border-border placeholder:text-terminal-muted"
          />
        </div>
      </div>

      {/* Row count */}
      <div className="px-3 pb-1 flex justify-between">
        <span className="text-terminal-xs text-terminal-dim">
          {result ? `${result.total} rows` : ""}
        </span>
        {sort && (
          <span className="text-terminal-xs text-terminal-cyan">
            sorted by {sort.key} {sort.direction}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-terminal-yellow glow-yellow animate-pulse">Loading...</span>
          </div>
        ) : result ? (
          <DataTable
            columns={result.meta.columns}
            rows={result.rows}
            onRowClick={handleRowClick}
            sort={sort}
            onSort={handleSort}
          />
        ) : null}
      </div>

      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        row={selectedRow}
        columns={activeDataset?.columns ?? []}
      />
    </div>
  );
}
