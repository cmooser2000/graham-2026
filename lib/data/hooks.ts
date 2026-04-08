"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DataSourceAdapter, DashboardMetric, DatasetMeta, QueryParams, QueryResult } from "./types";
import { fetchDatasets, fetchMetrics, fetchDatasetQuery } from "./postgres-provider";

export const DataSourceContext = createContext<DataSourceAdapter | null>(null);

export function useDataSource(): DataSourceAdapter {
  const ctx = useContext(DataSourceContext);
  if (!ctx) throw new Error("useDataSource must be used within DataProvider");
  return ctx;
}

export function useDatasets(): DatasetMeta[] {
  const ds = useDataSource();
  const [datasets, setDatasets] = useState<DatasetMeta[]>(() => ds.listDatasets());

  useEffect(() => {
    fetchDatasets().then(setDatasets).catch(() => {});
  }, []);

  return datasets;
}

export function useQuery(params: QueryParams | null): { result: QueryResult | null; loading: boolean } {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!params) return;
    setLoading(true);
    fetchDatasetQuery(params)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [params?.datasetId, params?.sort?.key, params?.sort?.direction, params?.search, params?.offset, params?.limit]);

  return { result, loading };
}

export function useMetrics(): { metrics: DashboardMetric[]; loading: boolean } {
  const [metrics, setMetrics] = useState<DashboardMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics()
      .then(setMetrics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { metrics, loading };
}

export function useSearch() {
  const ds = useDataSource();
  return useCallback(
    (query: string) => {
      if (!query.trim()) return { datasets: [], metrics: [] };
      return ds.search(query);
    },
    [ds]
  );
}
