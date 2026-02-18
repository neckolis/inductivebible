import { create } from "zustand";
import { syncMemoryToCloud, fetchMemoryFromCloud } from "../lib/sync";

const STORAGE_KEY = "word-symbol-memory";
const SUGGESTION_THRESHOLD = 3;

export interface WordAssociation {
  word: string;
  symbol: string;
  count: number;
  lastUsed: number;
}

interface MemoryState {
  // word (lowercase) -> associations
  associations: Record<string, WordAssociation[]>;

  // Record a word->symbol usage
  record: (word: string, symbol: string) => void;

  // Get suggestions for a word, sorted by confidence
  getSuggestions: (word: string) => WordAssociation[];

  // Get merged suggestions across multiple words, deduped by symbol value
  getAllSuggestions: (words: string[]) => WordAssociation[];
}

function loadFromStorage(): Record<string, WordAssociation[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, WordAssociation[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function persistMemory(data: Record<string, WordAssociation[]>) {
  saveToStorage(data);
  syncMemoryToCloud(data);
}

function confidence(assoc: WordAssociation): number {
  // Weight recent usage more heavily
  const daysSinceUse = (Date.now() - assoc.lastUsed) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.max(0.1, 1 - daysSinceUse / 90);
  return assoc.count * recencyFactor;
}

export const useMemoryStore = create<MemoryState>((set, get) => {
  // Background cloud sync on init
  fetchMemoryFromCloud().then(({ data }) => {
    if (!data) return;
    const current = get().associations;
    // Merge: add cloud-only words, merge associations
    const merged = { ...current };
    let changed = false;
    for (const [word, cloudAssocs] of Object.entries(data)) {
      if (!merged[word]) {
        merged[word] = cloudAssocs;
        changed = true;
      } else {
        // Merge associations for same word
        const localSymbols = new Set(merged[word].map((a) => a.symbol));
        for (const ca of cloudAssocs) {
          if (!localSymbols.has(ca.symbol)) {
            merged[word].push(ca);
            changed = true;
          }
        }
      }
    }
    if (changed) {
      set({ associations: merged });
      saveToStorage(merged);
    }
  });

  return {
    associations: loadFromStorage(),

    record: (word, symbol) => {
      const normalized = word.toLowerCase().replace(/[^a-z']/g, "");
      if (!normalized) return;

      set((state) => {
        const assocs = [...(state.associations[normalized] ?? [])];
        const existing = assocs.find((a) => a.symbol === symbol);
        if (existing) {
          existing.count++;
          existing.lastUsed = Date.now();
        } else {
          assocs.push({
            word: normalized,
            symbol,
            count: 1,
            lastUsed: Date.now(),
          });
        }
        const updated = { ...state.associations, [normalized]: assocs };
        persistMemory(updated);
        return { associations: updated };
      });
    },

    getSuggestions: (word) => {
      const normalized = word.toLowerCase().replace(/[^a-z']/g, "");
      const assocs = get().associations[normalized] ?? [];
      return assocs
        .filter((a) => a.count >= SUGGESTION_THRESHOLD)
        .sort((a, b) => confidence(b) - confidence(a));
    },

    getAllSuggestions: (words) => {
      const seen = new Set<string>();
      const results: WordAssociation[] = [];
      for (const word of words) {
        for (const assoc of get().getSuggestions(word)) {
          if (!seen.has(assoc.symbol)) {
            seen.add(assoc.symbol);
            results.push(assoc);
          }
        }
      }
      return results.sort((a, b) => confidence(b) - confidence(a));
    },
  };
});
