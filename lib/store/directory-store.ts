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
    label: "Donor Wiring Instructions",
    url: "https://drive.google.com/file/d/1ywpykU7zMkeFL7Xruzcr19IPLAs_Idx_/view?usp=drivesdk",
  },
  {
    label: "Receipts Submission",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSd7_IqGLFLHjgV4amizcX1VBrqkl5YBdPX7w7w_ThYIKsMNhA/viewform?usp=preview",
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
      name: "swallwell:ops",
    }
  )
);

export { DEFAULT_DIRECTORY, DEFAULT_LINKS };
export type { DirectoryEntry };
