import { create } from "zustand";
import type { NoteBlock, BlockType } from "../lib/noteTypes";
import { fetchNotesFromCloud, syncNotesToCloud } from "../lib/sync";

function genId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function storageKey(t: string, b: number, c: number): string {
  return `notes:${t}:${b}:${c}`;
}

function loadLocal(t: string, b: number, c: number): NoteBlock[] {
  try {
    const raw = localStorage.getItem(storageKey(t, b, c));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocal(t: string, b: number, c: number, blocks: NoteBlock[]) {
  try {
    localStorage.setItem(storageKey(t, b, c), JSON.stringify(blocks));
  } catch {}
}

interface NoteState {
  blocks: NoteBlock[];
  translation: string;
  book: number;
  chapter: number;

  loadNotes: (translation: string, book: number, chapter: number) => void;
  addBlock: (afterId: string | null, type?: BlockType) => string;
  updateBlock: (id: string, content: string) => void;
  changeBlockType: (id: string, type: BlockType) => void;
  deleteBlock: (id: string) => void;
  toggleChecked: (id: string) => void;
  moveBlock: (id: string, dir: "up" | "down") => void;
}

function persist(t: string, b: number, c: number, blocks: NoteBlock[]) {
  saveLocal(t, b, c, blocks);
  syncNotesToCloud(t, b, c, blocks);
}

export const useNoteStore = create<NoteState>((set, get) => ({
  blocks: [],
  translation: "",
  book: 0,
  chapter: 0,

  loadNotes: (translation, book, chapter) => {
    const blocks = loadLocal(translation, book, chapter);
    set({ translation, book, chapter, blocks });

    fetchNotesFromCloud(translation, book, chapter).then(({ data }) => {
      if (!data) return;
      const current = get();
      if (current.translation !== translation || current.book !== book || current.chapter !== chapter) return;
      // If local is empty, use cloud data
      if (current.blocks.length === 0 && data.length > 0) {
        set({ blocks: data });
        saveLocal(translation, book, chapter, data);
      }
    });
  },

  addBlock: (afterId, type = "text") => {
    const newId = genId();
    const newBlock: NoteBlock = { id: newId, type, content: "" };
    set((state) => {
      let blocks: NoteBlock[];
      if (afterId === null) {
        blocks = [...state.blocks, newBlock];
      } else {
        const idx = state.blocks.findIndex((b) => b.id === afterId);
        blocks = [...state.blocks];
        blocks.splice(idx + 1, 0, newBlock);
      }
      persist(state.translation, state.book, state.chapter, blocks);
      return { blocks };
    });
    return newId;
  },

  updateBlock: (id, content) => {
    set((state) => {
      const blocks = state.blocks.map((b) =>
        b.id === id ? { ...b, content } : b
      );
      persist(state.translation, state.book, state.chapter, blocks);
      return { blocks };
    });
  },

  changeBlockType: (id, type) => {
    set((state) => {
      const blocks = state.blocks.map((b) =>
        b.id === id ? { ...b, type } : b
      );
      persist(state.translation, state.book, state.chapter, blocks);
      return { blocks };
    });
  },

  deleteBlock: (id) => {
    set((state) => {
      const blocks = state.blocks.filter((b) => b.id !== id);
      persist(state.translation, state.book, state.chapter, blocks);
      return { blocks };
    });
  },

  toggleChecked: (id) => {
    set((state) => {
      const blocks = state.blocks.map((b) =>
        b.id === id ? { ...b, checked: !b.checked } : b
      );
      persist(state.translation, state.book, state.chapter, blocks);
      return { blocks };
    });
  },

  moveBlock: (id, dir) => {
    set((state) => {
      const idx = state.blocks.findIndex((b) => b.id === id);
      if (idx === -1) return state;
      const targetIdx = dir === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= state.blocks.length) return state;
      const blocks = [...state.blocks];
      [blocks[idx], blocks[targetIdx]] = [blocks[targetIdx], blocks[idx]];
      persist(state.translation, state.book, state.chapter, blocks);
      return { blocks };
    });
  },
}));
