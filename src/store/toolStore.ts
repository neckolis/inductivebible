import { create } from "zustand";

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

interface ToolState {
  activeColor: string;
  customColors: string[];
  setActiveColor: (color: string) => void;
  addCustomColor: (color: string) => void;
  removeCustomColor: (color: string) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeColor: PRESET_COLORS[0].hex,
  customColors: loadCustomColors(),
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
}));
