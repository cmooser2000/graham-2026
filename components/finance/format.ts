export function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return "$0";
  if (Math.abs(num) >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `$${(num / 1_000).toFixed(0)}K`;
  }
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return "0";
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPct(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return "0%";
  return `${num.toFixed(1)}%`;
}

export function formatCurrencyFull(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return "$0";
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
