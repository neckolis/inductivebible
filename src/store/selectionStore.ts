import { create } from "zustand";

export interface WordId {
  verse: number;
  wordIndex: number;
}

interface SelectionState {
  anchor: WordId | null;
  focus: WordId | null;
  isDragging: boolean;
  selectedWords: WordId[];
  selectedWordTexts: string[];
  setSelection: (anchor: WordId, focus?: WordId) => void;
  extendSelection: (focus: WordId) => void;
  clearSelection: () => void;
  setDragging: (v: boolean) => void;
  setSelectedWords: (words: WordId[], texts: string[]) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  anchor: null,
  focus: null,
  isDragging: false,
  selectedWords: [],
  selectedWordTexts: [],

  setSelection: (anchor, focus) =>
    set({ anchor, focus: focus ?? anchor }),

  extendSelection: (focus) =>
    set((state) => (state.anchor ? { focus } : {})),

  clearSelection: () => set({ anchor: null, focus: null, selectedWords: [], selectedWordTexts: [] }),

  setDragging: (v) => set({ isDragging: v }),

  setSelectedWords: (words, texts) => set({ selectedWords: words, selectedWordTexts: texts }),
}));

/**
 * Returns an ordered [start, end] range from anchor and focus.
 * Handles when user selects right-to-left.
 */
export function getSelectionRange(
  anchor: WordId,
  focus: WordId
): [WordId, WordId] {
  if (
    anchor.verse < focus.verse ||
    (anchor.verse === focus.verse && anchor.wordIndex <= focus.wordIndex)
  ) {
    return [anchor, focus];
  }
  return [focus, anchor];
}

export function isWordInRange(
  word: WordId,
  start: WordId,
  end: WordId
): boolean {
  if (word.verse < start.verse || word.verse > end.verse) return false;
  if (word.verse === start.verse && word.verse === end.verse) {
    return word.wordIndex >= start.wordIndex && word.wordIndex <= end.wordIndex;
  }
  if (word.verse === start.verse) return word.wordIndex >= start.wordIndex;
  if (word.verse === end.verse) return word.wordIndex <= end.wordIndex;
  return true;
}
