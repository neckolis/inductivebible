import { create } from "zustand";
import { syncSymbolsToCloud, fetchSymbolsFromCloud } from "../lib/sync";
import { formatSymbolValue } from "../lib/storage";

export interface SymbolDef {
  icon: string;
  label: string;
  color: string;
  weight: string;
  usageCount: number;
  lastUsed: number;
}

const STORAGE_KEY = "symbol-library";

const DEFAULT_SYMBOLS: SymbolDef[] = [
  { icon: "Cross", label: "Christ / Jesus", color: "#dc2626", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Triangle", label: "God", color: "#2563eb", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Dove", label: "Holy Spirit", color: "#7c3aed", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Covenant", label: "Covenant", color: "#d97706", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Heart", label: "Love", color: "#e11d48", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Trident", label: "Satan / Evil", color: "#374151", weight: "regular", usageCount: 0, lastUsed: 0 },
  { icon: "HandsPraying", label: "Prayer", color: "#0891b2", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Clock", label: "Time / When", color: "#059669", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Lamb", label: "Sacrifice / Lamb", color: "#dc2626", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Tablets", label: "Law / Commands", color: "#1d4ed8", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Tombstone", label: "Death / Die", color: "#6b7280", weight: "fill", usageCount: 0, lastUsed: 0 },
  { icon: "Chalice", label: "Blood / Cup", color: "#991b1b", weight: "fill", usageCount: 0, lastUsed: 0 },
];

function loadFromStorage(): SymbolDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SYMBOLS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SYMBOLS;
    // Migration: if old format with "emoji" field, discard and use defaults
    if (parsed[0] && "emoji" in parsed[0]) return DEFAULT_SYMBOLS;
    return parsed;
  } catch {
    return DEFAULT_SYMBOLS;
  }
}

function saveToStorage(symbols: SymbolDef[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // ignore
  }
}

function persistSymbols(symbols: SymbolDef[]) {
  saveToStorage(symbols);
  syncSymbolsToCloud(symbols);
}

function symbolKey(s: SymbolDef): string {
  return formatSymbolValue(s.icon, s.color, s.weight);
}

interface SymbolStoreState {
  symbols: SymbolDef[];
  addSymbol: (icon: string, label: string, color: string, weight: string) => void;
  removeSymbol: (icon: string, color: string, weight: string) => void;
  recordUsage: (icon: string, color: string, weight: string) => void;
  getRecent: (limit: number) => SymbolDef[];
}

export const useSymbolStore = create<SymbolStoreState>((set, get) => {
  // Background cloud sync on init
  fetchSymbolsFromCloud().then(({ data }) => {
    if (!data || data.length === 0) return;
    // If cloud data is old emoji format, skip
    if (data[0] && "emoji" in data[0]) return;
    const current = get().symbols;
    const localKeys = new Set(current.map(symbolKey));
    const merged = [...current];
    for (const s of data as SymbolDef[]) {
      if (!localKeys.has(symbolKey(s))) {
        merged.push(s);
      }
    }
    if (merged.length !== current.length) {
      set({ symbols: merged });
      saveToStorage(merged);
    }
  });

  return {
    symbols: loadFromStorage(),

    addSymbol: (icon, label, color, weight) => {
      set((state) => {
        const key = formatSymbolValue(icon, color, weight);
        if (state.symbols.some((s) => symbolKey(s) === key)) return state;
        const updated = [
          ...state.symbols,
          { icon, label, color, weight, usageCount: 0, lastUsed: 0 },
        ];
        persistSymbols(updated);
        return { symbols: updated };
      });
    },

    removeSymbol: (icon, color, weight) => {
      set((state) => {
        const key = formatSymbolValue(icon, color, weight);
        const updated = state.symbols.filter((s) => symbolKey(s) !== key);
        persistSymbols(updated);
        return { symbols: updated };
      });
    },

    recordUsage: (icon, color, weight) => {
      set((state) => {
        const key = formatSymbolValue(icon, color, weight);
        const updated = state.symbols.map((s) =>
          symbolKey(s) === key
            ? { ...s, usageCount: s.usageCount + 1, lastUsed: Date.now() }
            : s
        );
        persistSymbols(updated);
        return { symbols: updated };
      });
    },

    getRecent: (limit) => {
      return [...get().symbols]
        .sort((a, b) => b.lastUsed - a.lastUsed || b.usageCount - a.usageCount)
        .slice(0, limit);
    },
  };
});
