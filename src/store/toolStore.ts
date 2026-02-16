import { create } from "zustand";
import type { MarkingType } from "./markingStore";
import type { ArrowStyle, ArrowHeadStyle } from "../lib/storage";

export const PRESET_COLORS = [
  { hex: "#ef4444", name: "Red" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#a855f7", name: "Purple" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#6b7280", name: "Gray" },
];

function loadCustomColors(): string[] {
  try {
    const raw = localStorage.getItem("customColors");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveCustomColors(colors: string[]) {
  try {
    localStorage.setItem("customColors", JSON.stringify(colors));
  } catch {}
}

interface ArrowSource {
  verse: number;
  wordIndex: number;
}

interface ToolState {
  paintBrush: { type: MarkingType; value: string } | null;
  activeColor: string;
  customColors: string[];
  arrowMode: boolean;
  arrowSource: ArrowSource | null;
  arrowStyle: ArrowStyle;
  arrowHeadStyle: ArrowHeadStyle;
  setPaintBrush: (type: MarkingType, value: string) => void;
  clearPaintBrush: () => void;
  setActiveColor: (color: string) => void;
  addCustomColor: (color: string) => void;
  removeCustomColor: (color: string) => void;
  setArrowMode: (on: boolean) => void;
  setArrowSource: (source: ArrowSource | null) => void;
  setArrowStyle: (style: ArrowStyle) => void;
  setArrowHeadStyle: (style: ArrowHeadStyle) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  paintBrush: null,
  activeColor: PRESET_COLORS[0].hex,
  customColors: loadCustomColors(),
  arrowMode: false,
  arrowSource: null,
  arrowStyle: "solid" as ArrowStyle,
  arrowHeadStyle: "end" as ArrowHeadStyle,
  setPaintBrush: (type, value) => set({ paintBrush: { type, value }, arrowMode: false, arrowSource: null }),
  clearPaintBrush: () => set({ paintBrush: null }),
  setActiveColor: (color) => set({ activeColor: color }),
  addCustomColor: (color) =>
    set((state) => {
      if (state.customColors.length >= 4) return state;
      if (state.customColors.includes(color)) return state;
      const next = [...state.customColors, color];
      saveCustomColors(next);
      return { customColors: next, activeColor: color };
    }),
  removeCustomColor: (color) =>
    set((state) => {
      const next = state.customColors.filter((c) => c !== color);
      saveCustomColors(next);
      const newState: Partial<ToolState> = { customColors: next };
      if (state.activeColor === color) {
        newState.activeColor = PRESET_COLORS[0].hex;
      }
      return newState;
    }),
  setArrowMode: (on) =>
    set((state) => ({
      arrowMode: on,
      arrowSource: null,
      paintBrush: on ? null : state.paintBrush,
    })),
  setArrowSource: (source) => set({ arrowSource: source }),
  setArrowStyle: (style) => set({ arrowStyle: style }),
  setArrowHeadStyle: (style) => set({ arrowHeadStyle: style }),
}));
