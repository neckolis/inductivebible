import { create } from "zustand";
import { loadArrows, saveArrows, type ArrowConnection } from "../lib/storage";

const MAX_UNDO = 50;

interface ArrowState {
  translation: string;
  book: number;
  chapter: number;
  arrows: ArrowConnection[];
  undoStack: ArrowConnection[][];
  redoStack: ArrowConnection[][];

  loadChapter: (translation: string, book: number, chapter: number) => void;
  addArrow: (arrow: Omit<ArrowConnection, "id" | "createdAt">) => void;
  removeArrow: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function pushUndo(stack: ArrowConnection[][], current: ArrowConnection[]): ArrowConnection[][] {
  const next = [...stack, structuredClone(current)];
  if (next.length > MAX_UNDO) next.shift();
  return next;
}

function persist(translation: string, book: number, chapter: number, arrows: ArrowConnection[]) {
  saveArrows(translation, book, chapter, arrows);
}

export const useArrowStore = create<ArrowState>((set, get) => ({
  translation: "",
  book: 0,
  chapter: 0,
  arrows: [],
  undoStack: [],
  redoStack: [],

  loadChapter: (translation, book, chapter) => {
    const arrows = loadArrows(translation, book, chapter);
    set({ translation, book, chapter, arrows, undoStack: [], redoStack: [] });
  },

  addArrow: (params) => {
    const arrow: ArrowConnection = {
      ...params,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    set((state) => {
      const newArrows = [...state.arrows, arrow];
      persist(state.translation, state.book, state.chapter, newArrows);
      return {
        arrows: newArrows,
        undoStack: pushUndo(state.undoStack, state.arrows),
        redoStack: [],
      };
    });
  },

  removeArrow: (id) => {
    set((state) => {
      const newArrows = state.arrows.filter((a) => a.id !== id);
      persist(state.translation, state.book, state.chapter, newArrows);
      return {
        arrows: newArrows,
        undoStack: pushUndo(state.undoStack, state.arrows),
        redoStack: [],
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      persist(state.translation, state.book, state.chapter, prev);
      return {
        arrows: prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, structuredClone(state.arrows)],
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      persist(state.translation, state.book, state.chapter, next);
      return {
        arrows: next,
        undoStack: [...state.undoStack, structuredClone(state.arrows)],
        redoStack: state.redoStack.slice(0, -1),
      };
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
}));
