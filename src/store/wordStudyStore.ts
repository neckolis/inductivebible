import { create } from "zustand";
import type { WordStudyEntry } from "../lib/types";

interface WordStudyState {
  /** Dictionary modal entries */
  entries: WordStudyEntry[];
  loading: boolean;

  /** Fetch dictionary entries for selected words via Strong's numbers */
  fetchWordStudy: (params: {
    words: string[];
    book: number;
    chapter: number;
    startVerse: number;
    endVerse: number;
  }) => Promise<WordStudyEntry[]>;

  /** Load entries into dictionary modal */
  lookupSelection: (params: {
    words: string[];
    book: number;
    chapter: number;
    startVerse: number;
    endVerse: number;
  }) => Promise<void>;

  clearEntries: () => void;
}

export const useWordStudyStore = create<WordStudyState>((set) => ({
  entries: [],
  loading: false,

  fetchWordStudy: async (params) => {
    try {
      const res = await fetch("/api/word-study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.entries ?? [];
    } catch {
      return [];
    }
  },

  lookupSelection: async (params) => {
    set({ loading: true, entries: [] });
    try {
      const res = await fetch("/api/word-study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        set({ loading: false });
        return;
      }
      const data = await res.json();
      set({ entries: data.entries ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  clearEntries: () => set({ entries: [], loading: false }),
}));
