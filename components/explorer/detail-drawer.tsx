"use client";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { DataRow, ColumnDef } from "@/lib/data/types";

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: DataRow | null;
  columns: ColumnDef[];
}

function formatCellValue(value: unknown, type: ColumnDef["type"]): string {
  if (value === null || value === undefined) return "-";
  switch (type) {
    case "currency":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value));
    case "date":
      return value instanceof Date ? value.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : String(value);
    case "boolean":
      return value ? "YES" : "NO";
    case "number":
      return Number(value).toLocaleString();
    default:
      return String(value);
  }
}

export function DetailDrawer({ open, onOpenChange, row, columns }: DetailDrawerProps) {
  if (!row) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-terminal-panel border-terminal-overlay max-h-[80dvh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-terminal-blue text-terminal-sm tracking-widest uppercase">
            Record Detail
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-y-auto">
          {columns.map((col, i) => (
            <div key={col.key}>
              {i > 0 && <Separator className="bg-border/50" />}
              <div className="flex items-center justify-between py-2.5">
                <span className="text-terminal-xs text-terminal-dim uppercase tracking-wider">
                  {col.label}
                </span>
                <span
                  className={`text-terminal-sm tabular-nums ${
                    col.type === "currency"
                      ? "text-terminal-yellow"
                      : col.type === "boolean"
                        ? row[col.key] ? "text-terminal-red font-medium" : "text-terminal-dim"
                        : "text-foreground"
                  }`}
                >
                  {formatCellValue(row[col.key], col.type)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
