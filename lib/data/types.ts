export interface ColumnDef {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "currency";
  sortable?: boolean;
  align?: "left" | "right" | "center";
}

export interface DatasetMeta {
  id: string;
  name: string;
  description: string;
  columns: ColumnDef[];
  rowCount: number;
  lastUpdated: Date;
}

export type DataRow = Record<string, string | number | boolean | Date>;

export interface QueryParams {
  datasetId: string;
  sort?: { key: string; direction: "asc" | "desc" };
  filters?: { key: string; operator: "eq" | "gt" | "lt" | "contains"; value: string | number }[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  rows: DataRow[];
  total: number;
  meta: DatasetMeta;
}

export interface MetricPoint {
  timestamp: number;
  value: number;
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: number;
  previousValue: number;
  format: "number" | "currency" | "percent" | "compact";
  sparkline: MetricPoint[];
  category: string;
}

export interface AlertConfig {
  id: string;
  metricId: string;
  metricLabel: string;
  condition: "above" | "below" | "change";
  threshold: number;
  enabled: boolean;
  lastTriggered?: Date;
}

export interface WatchlistItem {
  id: string;
  metricId: string;
  label: string;
  value: number;
  previousValue: number;
  format: "number" | "currency" | "percent" | "compact";
  addedAt: Date;
}

export interface DataSourceAdapter {
  name: string;
  listDatasets(): DatasetMeta[];
  query(params: QueryParams): QueryResult;
  getMetrics(): DashboardMetric[];
  search(query: string): { datasets: DatasetMeta[]; metrics: DashboardMetric[] };
  subscribe(callback: (metrics: DashboardMetric[]) => void): () => void;
}
