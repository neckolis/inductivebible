import { create } from "zustand";
import {
  loadMarkings,
  saveMarkings,
  hasAnyMarking,
  type WordMarkings,
} from "../lib/storage";
import {
  syncMarkingsToCloud,
  fetchMarkingsFromCloud,
  fetchMarkingsBackup,
  restoreMarkingsFromBackup,
} from "../lib/sync";

export type MarkingType = "symbol" | "highlight" | "underline";

const MAX_UNDO = 50;

function wordKey(verse: number, wordIndex: number): string {
  return `${verse}:${wordIndex}`;
}

interface MarkingState {
  translation: string;
  book: number;
  chapter: number;
  markings: Record<string, WordMarkings>;

  // Undo/redo stacks (snapshots of markings)
  undoStack: Record<string, WordMarkings>[];
  redoStack: Record<string, WordMarkings>[];
  lastAction: string | null;

  // Cloud backup
  hasCloudBackup: boolean;

  loadChapter: (translation: string, book: number, chapter: number) => void;
  addMarking: (
    verse: number,
    wordIndex: number,
    type: MarkingType,
    value: string
  ) => void;
  removeMarking: (verse: number, wordIndex: number, type?: MarkingType) => void;
  getMarking: (verse: number, wordIndex: number) => WordMarkings | undefined;
  clearChapter: () => void;
  clearVerse: (verse: number) => void;
  clearSymbolInChapter: (symbol: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  checkBackup: () => void;
  restoreFromBackup: () => Promise<void>;
}

function pushUndo(
  undoStack: Record<string, WordMarkings>[],
  currentMarkings: Record<string, WordMarkings>
): Record<string, WordMarkings>[] {
  const stack = [...undoStack, structuredClone(currentMarkings)];
  if (stack.length > MAX_UNDO) stack.shift();
  return stack;
}

function persist(
  translation: string,
  book: number,
  chapter: number,
  markings: Record<string, WordMarkings>
) {
  saveMarkings(translation, book, chapter, markings);
  syncMarkingsToCloud(translation, book, chapter, markings);
}

export const useMarkingStore = create<MarkingState>((set, get) => ({
  translation: "",
  book: 0,
  chapter: 0,
  markings: {},
  undoStack: [],
  redoStack: [],
  lastAction: null,
  hasCloudBackup: false,

  loadChapter: (translation, book, chapter) => {
    const markings = loadMarkings(translation, book, chapter);
    set({ translation, book, chapter, markings, undoStack: [], redoStack: [], lastAction: null, hasCloudBackup: false });

    // Check for backup if local markings are empty
    if (Object.keys(markings).length === 0) {
      get().checkBackup();
    }

    // Background cloud sync: pull and merge
    fetchMarkingsFromCloud(translation, book, chapter).then(({ data }) => {
      if (!data) return;
      const current = get();
      // Only merge if we're still on the same chapter
      if (current.translation !== translation || current.book !== book || current.chapter !== chapter) return;

      // Merge: cloud data fills in anything missing locally
      const merged = { ...data, ...current.markings };
      // Also pick up cloud-only entries
      for (const key of Object.keys(data)) {
        if (!current.markings[key]) {
          merged[key] = data[key];
        }
      }

      set({ markings: merged });
      saveMarkings(translation, book, chapter, merged);
    });
  },

  addMarking: (verse, wordIndex, type, value) => {
    const key = wordKey(verse, wordIndex);
    set((state) => {
      const existing = state.markings[key] ?? {};
      const newEntry: WordMarkings = {
        ...existing,
        [type]: { value, createdAt: Date.now() },
      };
      const newMarkings = { ...state.markings, [key]: newEntry };
      const newState = {
        markings: newMarkings,
        undoStack: pushUndo(state.undoStack, state.markings),
        redoStack: [] as Record<string, WordMarkings>[],
        lastAction: `Applied ${type}`,
      };
      persist(state.translation, state.book, state.chapter, newMarkings);
      return newState;
    });
  },

  removeMarking: (verse, wordIndex, type?) => {
    const key = wordKey(verse, wordIndex);
    set((state) => {
      const existing = state.markings[key];
      if (!existing) return state;

      let newMarkings: Record<string, WordMarkings>;
      if (type) {
        const { [type]: _, ...rest } = existing;
        if (hasAnyMarking(rest as WordMarkings)) {
          newMarkings = { ...state.markings, [key]: rest as WordMarkings };
        } else {
          const { [key]: __, ...withoutKey } = state.markings;
          newMarkings = withoutKey;
        }
      } else {
        const { [key]: _, ...rest } = state.markings;
        newMarkings = rest;
      }

      const newState = {
        markings: newMarkings,
        undoStack: pushUndo(state.undoStack, state.markings),
        redoStack: [] as Record<string, WordMarkings>[],
        lastAction: type ? `Removed ${type}` : "Removed mark",
      };
      persist(state.translation, state.book, state.chapter, newMarkings);
      return newState;
    });
  },

  getMarking: (verse, wordIndex) => {
    return get().markings[wordKey(verse, wordIndex)];
  },

  clearChapter: () => {
    set((state) => {
      const count = Object.keys(state.markings).length;
      const newState = {
        markings: {} as Record<string, WordMarkings>,
        undoStack: pushUndo(state.undoStack, state.markings),
        redoStack: [] as Record<string, WordMarkings>[],
        lastAction: `Cleared ${count} marks`,
      };
      persist(state.translation, state.book, state.chapter, {});
      // Check for cloud backup after sync completes
      setTimeout(() => get().checkBackup(), 2000);
      return newState;
    });
  },

  clearVerse: (verse) => {
    set((state) => {
      const newMarkings = { ...state.markings };
      let count = 0;
      for (const key of Object.keys(newMarkings)) {
        if (key.startsWith(`${verse}:`)) {
          delete newMarkings[key];
          count++;
        }
      }
      const newState = {
        markings: newMarkings,
        undoStack: pushUndo(state.undoStack, state.markings),
        redoStack: [] as Record<string, WordMarkings>[],
        lastAction: `Cleared ${count} marks in verse ${verse}`,
      };
      persist(state.translation, state.book, state.chapter, newMarkings);
      return newState;
    });
  },

  clearSymbolInChapter: (symbol) => {
    set((state) => {
      const newMarkings = { ...state.markings };
      let count = 0;
      for (const [key, m] of Object.entries(newMarkings)) {
        if (m.symbol?.value === symbol) {
          const { symbol: _, ...rest } = m;
          if (hasAnyMarking(rest as WordMarkings)) {
            newMarkings[key] = rest as WordMarkings;
          } else {
            delete newMarkings[key];
          }
          count++;
        }
      }
      const newState = {
        markings: newMarkings,
        undoStack: pushUndo(state.undoStack, state.markings),
        redoStack: [] as Record<string, WordMarkings>[],
        lastAction: `Cleared ${count} ${symbol} marks`,
      };
      persist(state.translation, state.book, state.chapter, newMarkings);
      return newState;
    });
  },

  undo: () => {
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      const newState = {
        markings: prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, structuredClone(state.markings)],
        lastAction: null,
      };
      persist(state.translation, state.book, state.chapter, prev);
      return newState;
    });
  },

  redo: () => {
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const newState = {
        markings: next,
        undoStack: [...state.undoStack, structuredClone(state.markings)],
        redoStack: state.redoStack.slice(0, -1),
        lastAction: null,
      };
      persist(state.translation, state.book, state.chapter, next);
      return newState;
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  checkBackup: () => {
    const { translation, book, chapter } = get();
    fetchMarkingsBackup(translation, book, chapter).then(({ data }) => {
      const current = get();
      if (current.translation !== translation || current.book !== book || current.chapter !== chapter) return;
      set({ hasCloudBackup: data !== null && Object.keys(data).length > 0 });
    });
  },

  restoreFromBackup: async () => {
    const { translation, book, chapter } = get();
    const result = await restoreMarkingsFromBackup(translation, book, chapter);
    if (result.ok && result.data) {
      set((state) => ({
        markings: result.data!,
        undoStack: pushUndo(state.undoStack, state.markings),
        redoStack: [] as Record<string, WordMarkings>[],
        lastAction: null,
        hasCloudBackup: false,
      }));
      saveMarkings(translation, book, chapter, result.data);
    }
  },
}));
