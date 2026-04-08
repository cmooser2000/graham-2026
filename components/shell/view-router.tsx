"use client";

import { useAppStore } from "@/lib/store/app-store";
import { MarketsView } from "@/components/markets/markets-view";
import { FinanceView } from "@/components/finance/finance-view";
import { InternetView } from "@/components/internet/internet-view";
import { QueriesView } from "@/components/queries/queries-view";
import { OperationsView } from "@/components/operations/operations-view";
import { FieldView } from "@/components/field/field-view";

export function ViewRouter() {
  const activeView = useAppStore((s) => s.activeView);

  switch (activeView) {
    case "markets":
      return <MarketsView />;
    case "finance":
      return <FinanceView />;
    case "internet":
      return <InternetView />;
    case "field":
      return <FieldView />;
    case "operations":
      return <OperationsView />;
    case "queries":
      return <QueriesView />;
    default:
      return <MarketsView />;
  }
}
