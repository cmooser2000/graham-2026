import { create } from "zustand";

export type ViewId = "markets" | "finance" | "internet" | "operations" | "queries";

interface AppState {
  activeView: ViewId;
  activeDatasetId: string;
  pendingQuery: string | null;
  setActiveView: (view: ViewId) => void;
  setActiveDatasetId: (id: string) => void;
  submitQuery: (query: string) => void;
  clearPendingQuery: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: "markets",
  activeDatasetId: "summary",
  pendingQuery: null,
  setActiveView: (view) => set({ activeView: view }),
  setActiveDatasetId: (id) => set({ activeDatasetId: id }),
  submitQuery: (query) => set({ pendingQuery: query, activeView: "queries" }),
  clearPendingQuery: () => set({ pendingQuery: null }),
}));
