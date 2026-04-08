import {
  DataSourceAdapter,
  DatasetMeta,
  DashboardMetric,
  QueryParams,
  QueryResult,
  DataRow,
  MetricPoint,
} from "./types";

function generateSparkline(
  baseValue: number,
  volatility: number,
  points: number = 24
): MetricPoint[] {
  const now = Date.now();
  const data: MetricPoint[] = [];
  let value = baseValue * (0.85 + Math.random() * 0.15);
  for (let i = 0; i < points; i++) {
    value += (Math.random() - 0.48) * volatility;
    value = Math.max(value * 0.5, Math.min(value * 1.5, value));
    data.push({ timestamp: now - (points - i) * 3600000, value });
  }
  return data;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomDate(daysBack: number): Date {
  return new Date(Date.now() - Math.random() * daysBack * 86400000);
}

const COMPANY_NAMES = [
  "Meridian Holdings", "Apex Digital", "Nordic Wave", "Cascade Systems",
  "Prism Analytics", "Vertex Labs", "Solstice Energy", "Quantum Dynamics",
  "Atlas Ventures", "Nebula Corp", "Zenith Partners", "Obsidian Tech",
  "Helix BioScience", "Forge Industries", "Polaris Capital", "Strata Mining",
  "Cipher Security", "Radiant Health", "Oasis Logistics", "Ember Finance",
];

const SECTORS = ["Technology", "Finance", "Energy", "Healthcare", "Mining", "Logistics", "Security"];
const STATUSES = ["Active", "Under Review", "Flagged", "Cleared", "Pending"];
const TX_TYPES = ["Wire Transfer", "ACH", "Card Payment", "Internal", "FX Conversion"];
const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY"];
const ENDPOINTS = ["/api/search", "/api/entity", "/api/transactions", "/api/risk", "/api/auth", "/api/reports", "/api/export", "/api/webhook"];

function generateCompanyData(): DataRow[] {
  return COMPANY_NAMES.map((name, i) => ({
    id: `ENT-${String(i + 1).padStart(4, "0")}`,
    name,
    sector: SECTORS[Math.floor(Math.random() * SECTORS.length)],
    revenue: Math.round(randomBetween(5, 500) * 1e6),
    employees: Math.round(randomBetween(50, 10000)),
    risk_score: Math.round(randomBetween(10, 95)),
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
    founded: new Date(1990 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), 1),
    country: ["US", "UK", "DE", "CH", "JP", "SG"][Math.floor(Math.random() * 6)],
  }));
}

function generateTransactionData(): DataRow[] {
  const rows: DataRow[] = [];
  for (let i = 0; i < 50; i++) {
    rows.push({
      tx_id: `TX-${String(i + 1).padStart(6, "0")}`,
      date: randomDate(90),
      type: TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)],
      amount: Math.round(randomBetween(100, 2500000) * 100) / 100,
      currency: CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)],
      sender: COMPANY_NAMES[Math.floor(Math.random() * COMPANY_NAMES.length)],
      receiver: COMPANY_NAMES[Math.floor(Math.random() * COMPANY_NAMES.length)],
      status: ["Completed", "Pending", "Failed", "Flagged"][Math.floor(Math.random() * 4)],
      risk_flag: Math.random() > 0.7,
    });
  }
  return rows;
}

function generateApiMetricsData(): DataRow[] {
  const rows: DataRow[] = [];
  for (let i = 0; i < 30; i++) {
    const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    rows.push({
      endpoint,
      method: ["GET", "POST", "PUT", "DELETE"][Math.floor(Math.random() * 4)],
      avg_latency_ms: Math.round(randomBetween(12, 850)),
      p99_latency_ms: Math.round(randomBetween(100, 3000)),
      requests_1h: Math.round(randomBetween(100, 50000)),
      error_rate: Math.round(randomBetween(0, 8) * 100) / 100,
      status_2xx: Math.round(randomBetween(90, 100) * 10) / 10,
      cache_hit_rate: Math.round(randomBetween(20, 95) * 10) / 10,
    });
  }
  return rows;
}

const DATASETS: DatasetMeta[] = [
  {
    id: "company-registry",
    name: "Company Registry",
    description: "Entity database with risk scoring and compliance status",
    rowCount: 20,
    lastUpdated: new Date(),
    columns: [
      { key: "id", label: "Entity ID", type: "string", sortable: true },
      { key: "name", label: "Company Name", type: "string", sortable: true },
      { key: "sector", label: "Sector", type: "string", sortable: true },
      { key: "revenue", label: "Revenue", type: "currency", sortable: true, align: "right" },
      { key: "employees", label: "Employees", type: "number", sortable: true, align: "right" },
      { key: "risk_score", label: "Risk Score", type: "number", sortable: true, align: "right" },
      { key: "status", label: "Status", type: "string", sortable: true },
      { key: "country", label: "Country", type: "string", sortable: true },
    ],
  },
  {
    id: "transaction-log",
    name: "Transaction Log",
    description: "Financial transactions with risk flagging",
    rowCount: 50,
    lastUpdated: new Date(),
    columns: [
      { key: "tx_id", label: "TX ID", type: "string", sortable: true },
      { key: "date", label: "Date", type: "date", sortable: true },
      { key: "type", label: "Type", type: "string", sortable: true },
      { key: "amount", label: "Amount", type: "currency", sortable: true, align: "right" },
      { key: "currency", label: "CCY", type: "string", sortable: true },
      { key: "sender", label: "Sender", type: "string", sortable: true },
      { key: "receiver", label: "Receiver", type: "string", sortable: true },
      { key: "status", label: "Status", type: "string", sortable: true },
      { key: "risk_flag", label: "Risk Flag", type: "boolean", sortable: true },
    ],
  },
  {
    id: "api-metrics",
    name: "API Metrics",
    description: "Real-time API performance and error tracking",
    rowCount: 30,
    lastUpdated: new Date(),
    columns: [
      { key: "endpoint", label: "Endpoint", type: "string", sortable: true },
      { key: "method", label: "Method", type: "string", sortable: true },
      { key: "avg_latency_ms", label: "Avg Latency (ms)", type: "number", sortable: true, align: "right" },
      { key: "p99_latency_ms", label: "P99 (ms)", type: "number", sortable: true, align: "right" },
      { key: "requests_1h", label: "Req/1h", type: "number", sortable: true, align: "right" },
      { key: "error_rate", label: "Error %", type: "number", sortable: true, align: "right" },
      { key: "status_2xx", label: "2xx %", type: "number", sortable: true, align: "right" },
      { key: "cache_hit_rate", label: "Cache Hit %", type: "number", sortable: true, align: "right" },
    ],
  },
];

const DATA_CACHE: Record<string, DataRow[]> = {};

function getData(datasetId: string): DataRow[] {
  if (!DATA_CACHE[datasetId]) {
    switch (datasetId) {
      case "company-registry":
        DATA_CACHE[datasetId] = generateCompanyData();
        break;
      case "transaction-log":
        DATA_CACHE[datasetId] = generateTransactionData();
        break;
      case "api-metrics":
        DATA_CACHE[datasetId] = generateApiMetricsData();
        break;
      default:
        DATA_CACHE[datasetId] = [];
    }
  }
  return DATA_CACHE[datasetId];
}

function generateMetrics(): DashboardMetric[] {
  return [
    { id: "total-entities", label: "TOTAL ENTITIES", value: 14283, previousValue: 14201, format: "compact", sparkline: generateSparkline(14200, 50), category: "entities" },
    { id: "active-flags", label: "ACTIVE FLAGS", value: 47, previousValue: 52, format: "number", sparkline: generateSparkline(50, 3), category: "risk" },
    { id: "tx-volume-24h", label: "TX VOL 24H", value: 2847500, previousValue: 2654300, format: "currency", sparkline: generateSparkline(2700000, 100000), category: "transactions" },
    { id: "avg-risk-score", label: "AVG RISK SCORE", value: 34.7, previousValue: 36.2, format: "number", sparkline: generateSparkline(35, 1.5), category: "risk" },
    { id: "api-latency", label: "API LATENCY", value: 127, previousValue: 134, format: "number", sparkline: generateSparkline(130, 15), category: "performance" },
    { id: "error-rate", label: "ERROR RATE", value: 0.23, previousValue: 0.31, format: "percent", sparkline: generateSparkline(0.27, 0.05), category: "performance" },
    { id: "cache-hit", label: "CACHE HIT", value: 94.2, previousValue: 93.8, format: "percent", sparkline: generateSparkline(94, 0.5), category: "performance" },
    { id: "active-users", label: "ACTIVE USERS", value: 342, previousValue: 328, format: "number", sparkline: generateSparkline(335, 10), category: "users" },
    { id: "pending-reviews", label: "PENDING REVIEWS", value: 18, previousValue: 23, format: "number", sparkline: generateSparkline(20, 2), category: "risk" },
    { id: "data-freshness", label: "DATA FRESHNESS", value: 99.7, previousValue: 99.5, format: "percent", sparkline: generateSparkline(99.6, 0.1), category: "performance" },
  ];
}

let currentMetrics: DashboardMetric[] | null = null;

export function createMockProvider(): DataSourceAdapter {
  const subscribers = new Set<(metrics: DashboardMetric[]) => void>();
  let interval: ReturnType<typeof setInterval> | null = null;

  function getMetrics(): DashboardMetric[] {
    if (!currentMetrics) {
      currentMetrics = generateMetrics();
    }
    return currentMetrics;
  }

  function tickMetrics() {
    if (!currentMetrics) return;
    currentMetrics = currentMetrics.map((m) => {
      const change = (Math.random() - 0.48) * (m.value * 0.01);
      const newValue = m.format === "percent"
        ? Math.round((m.value + change * 0.1) * 100) / 100
        : m.format === "currency"
          ? Math.round(m.value + change)
          : m.format === "compact"
            ? Math.round(m.value + change)
            : Math.round((m.value + change) * 10) / 10;
      const newSparkline = [...m.sparkline.slice(1), { timestamp: Date.now(), value: newValue }];
      return { ...m, previousValue: m.value, value: newValue, sparkline: newSparkline };
    });
    subscribers.forEach((cb) => cb(currentMetrics!));
  }

  return {
    name: "Mock Data",

    listDatasets(): DatasetMeta[] {
      return DATASETS;
    },

    query(params: QueryParams): QueryResult {
      const meta = DATASETS.find((d) => d.id === params.datasetId);
      if (!meta) {
        return { rows: [], total: 0, meta: DATASETS[0] };
      }

      let rows = [...getData(params.datasetId)];

      if (params.search) {
        const q = params.search.toLowerCase();
        rows = rows.filter((row) =>
          Object.values(row).some((v) => String(v).toLowerCase().includes(q))
        );
      }

      if (params.filters) {
        for (const f of params.filters) {
          rows = rows.filter((row) => {
            const val = row[f.key];
            switch (f.operator) {
              case "eq": return val === f.value;
              case "gt": return Number(val) > Number(f.value);
              case "lt": return Number(val) < Number(f.value);
              case "contains": return String(val).toLowerCase().includes(String(f.value).toLowerCase());
              default: return true;
            }
          });
        }
      }

      if (params.sort) {
        const { key, direction } = params.sort;
        rows.sort((a, b) => {
          const av = a[key];
          const bv = b[key];
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return direction === "asc" ? cmp : -cmp;
        });
      }

      const total = rows.length;
      const offset = params.offset ?? 0;
      const limit = params.limit ?? 100;
      rows = rows.slice(offset, offset + limit);

      return { rows, total, meta };
    },

    getMetrics,

    search(query: string) {
      const q = query.toLowerCase();
      const matchedDatasets = DATASETS.filter(
        (d) => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
      );
      const matchedMetrics = getMetrics().filter(
        (m) => m.label.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
      );
      return { datasets: matchedDatasets, metrics: matchedMetrics };
    },

    subscribe(callback: (metrics: DashboardMetric[]) => void): () => void {
      subscribers.add(callback);
      if (!interval) {
        interval = setInterval(tickMetrics, 2500);
      }
      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0 && interval) {
          clearInterval(interval);
          interval = null;
        }
      };
    },
  };
}
