import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DIRECTORY as DEFAULT_DIRECTORY,
  type DirectoryEntry,
} from "@/lib/data/directory";

export interface OpsLink {
  label: string;
  url: string;
}

const DEFAULT_LINKS: OpsLink[] = [
  {
    label: "Graham for Maine — Official Campaign Site",
    url: "https://grahamformaine.com",
  },
  {
    label: "FEC Filing — Graham Platner (C00916437)",
    url: "https://www.fec.gov/data/committee/C00916437/",
  },
  {
    label: "Donate to Graham Platner",
    url: "https://grahamformaine.com/donate",
  },
  {
    label: "Volunteer with Graham for Maine",
    url: "https://grahamformaine.com/volunteer",
  },
];

interface DirectoryStore {
  directory: DirectoryEntry[] | null;
  links: OpsLink[] | null;

  getDirectory: () => DirectoryEntry[];
  getLinks: () => OpsLink[];

  setDirectory: (entries: DirectoryEntry[]) => void;
  setLinks: (links: OpsLink[]) => void;

  resetDirectory: () => void;
  resetLinks: () => void;
  resetAll: () => void;
}

export const useDirectoryStore = create<DirectoryStore>()(
  persist(
    (set, get) => ({
      directory: null,
      links: null,

      getDirectory: () => get().directory ?? DEFAULT_DIRECTORY,
      getLinks: () => get().links ?? DEFAULT_LINKS,

      setDirectory: (entries) => set({ directory: entries }),
      setLinks: (links) => set({ links }),

      resetDirectory: () => set({ directory: null }),
      resetLinks: () => set({ links: null }),
      resetAll: () => set({ directory: null, links: null }),
    }),
    {
      name: "platner:ops",
    }
  )
);

export { DEFAULT_DIRECTORY, DEFAULT_LINKS };
export type { DirectoryEntry };
