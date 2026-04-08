import {
  DataSourceAdapter,
  DatasetMeta,
  DashboardMetric,
  QueryParams,
  QueryResult,
  DataRow,
} from "./types";

// Cache for pre-fetched data
let datasetsCache: DatasetMeta[] | null = null;
let metricsCache: DashboardMetric[] | null = null;

async function fetchJSON(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed: ${path}`);
  return res.json();
}

export function createPostgresProvider(): DataSourceAdapter {
  return {
    name: "ME SEN 2026",

    listDatasets(): DatasetMeta[] {
      // Return cached or placeholder datasets synchronously
      // The hooks layer handles async fetching
      if (datasetsCache) return datasetsCache;
      // Return placeholder datasets that match the API
      return [
        { id: "summary", name: "Campaign Summary", description: "Cash on hand, receipts, expenditures, burn rate per candidate", columns: [], rowCount: 9, lastUpdated: new Date() },
        { id: "contributions", name: "Contributions", description: "Donor counts, averages, repeat rates per candidate", columns: [], rowCount: 9, lastUpdated: new Date() },
        { id: "spending", name: "Spending", description: "Expenditure totals and category breakdowns", columns: [], rowCount: 9, lastUpdated: new Date() },
        { id: "donors", name: "Top Donors", description: "Searchable donor records across all candidates", columns: [], rowCount: 190, lastUpdated: new Date() },
        { id: "geography", name: "Geography", description: "In-state vs out-of-state contributions", columns: [], rowCount: 9, lastUpdated: new Date() },
        { id: "filings", name: "Filings", description: "Campaign filing records from FEC", columns: [], rowCount: 10, lastUpdated: new Date() },
      ];
    },

    query(params: QueryParams): QueryResult {
      // Synchronous stub — actual data fetching is done by the hooks via API
      const meta = this.listDatasets().find(d => d.id === params.datasetId);
      return { rows: [], total: 0, meta: meta || this.listDatasets()[0] };
    },

    getMetrics(): DashboardMetric[] {
      return metricsCache || [];
    },

    search(q: string) {
      const lower = q.toLowerCase();
      const matchedDatasets = this.listDatasets().filter(
        d => d.name.toLowerCase().includes(lower) || d.description.toLowerCase().includes(lower)
      );
      const matchedMetrics = this.getMetrics().filter(
        m => m.label.toLowerCase().includes(lower) || m.category.toLowerCase().includes(lower)
      );
      return { datasets: matchedDatasets, metrics: matchedMetrics };
    },

    subscribe(): () => void {
      // Political data doesn't tick in real-time
      return () => {};
    },
  };
}

// Async initialization functions called from hooks
export async function fetchDatasets(): Promise<DatasetMeta[]> {
  if (datasetsCache) return datasetsCache;
  const data = await fetchJSON("/api/datasets");
  datasetsCache = data.map((d: { id: string; name: string; description: string; rowCount: number; lastUpdated: string }) => ({
    ...d,
    columns: [],
    lastUpdated: new Date(d.lastUpdated),
  }));
  return datasetsCache!;
}

export async function fetchMetrics(): Promise<DashboardMetric[]> {
  const data = await fetchJSON("/api/metrics");
  metricsCache = data.map((m: { id: string; label: string; value: number; format: string; category: string }) => ({
    ...m,
    previousValue: m.value,
    sparkline: [],
  }));
  return metricsCache!;
}

export async function fetchDatasetQuery(params: QueryParams): Promise<QueryResult> {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.sort) {
    sp.set("sortKey", params.sort.key);
    sp.set("sortDir", params.sort.direction);
  }
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));

  const data = await fetchJSON(`/api/datasets/${params.datasetId}?${sp.toString()}`);
  return {
    rows: data.rows as DataRow[],
    total: data.total,
    meta: {
      ...data.meta,
      lastUpdated: new Date(data.meta.lastUpdated),
    },
  };
}
