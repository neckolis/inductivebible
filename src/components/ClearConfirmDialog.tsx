import { useEffect } from "react";
import type { WordMarkings } from "../lib/storage";

interface Props {
  markings: Record<string, WordMarkings>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClearConfirmDialog({ markings, onConfirm, onCancel }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);
  const entries = Object.values(markings);
  const total = entries.length;

  // Count by layer type and value
  const groups: Record<string, number> = {};
  for (const m of entries) {
    if (m.highlight) {
      const label = `highlight: ${m.highlight.value}`;
      groups[label] = (groups[label] ?? 0) + 1;
    }
    if (m.underline) {
      const label = `underline: ${m.underline.value}`;
      groups[label] = (groups[label] ?? 0) + 1;
    }
    if (m.symbol) {
      groups[m.symbol.value] = (groups[m.symbol.value] ?? 0) + 1;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Clear {total} marked words in this chapter?
        </h3>
        <div className="space-y-1 mb-5">
          {Object.entries(groups).map(([label, count]) => (
            <div
              key={label}
              className="flex justify-between text-sm text-gray-600"
            >
              <span>{label}</span>
              <span className="text-gray-400">{count} marks</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors bg-transparent border-none cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors border-none cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
