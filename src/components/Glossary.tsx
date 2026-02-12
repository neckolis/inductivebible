import { useState, useMemo } from "react";
import { useMemoryStore } from "../store/memoryStore";
import { parseSymbolValue } from "../lib/storage";
import { getIconComponent } from "../lib/icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

function renderSymbolPreview(symbolValue: string) {
  const parsed = parseSymbolValue(symbolValue);
  if (!parsed) {
    // Legacy emoji
    return <span className="text-lg">{symbolValue}</span>;
  }
  const Icon = getIconComponent(parsed.icon);
  if (!Icon) return <span className="text-xs text-gray-400">{parsed.icon}</span>;
  return <Icon size={20} color={parsed.color} weight={parsed.weight as "fill"} />;
}

export function Glossary({ open, onClose }: Props) {
  const associations = useMemoryStore((s) => s.associations);
  const [search, setSearch] = useState("");

  const entries = useMemo(() => {
    const result: { word: string; symbol: string; count: number }[] = [];
    for (const [word, assocs] of Object.entries(associations)) {
      for (const a of assocs) {
        result.push({ word, symbol: a.symbol, count: a.count });
      }
    }
    result.sort((a, b) => b.count - a.count);
    if (search.trim()) {
      const q = search.toLowerCase();
      return result.filter((e) => e.word.includes(q));
    }
    return result;
  }, [associations, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 p-5 max-w-md w-full mx-4 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Glossary</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-lg"
          >
            &times;
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter words..."
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-400 mb-3"
        />

        <div className="overflow-y-auto flex-1">
          {entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              No word associations yet. Apply symbols to words to build your glossary.
            </p>
          )}
          {entries.map((e, i) => (
            <div
              key={`${e.word}-${e.symbol}-${i}`}
              className="flex items-center gap-3 py-1.5 px-1 border-b border-gray-50 last:border-0"
            >
              <span className="text-sm text-gray-800 font-medium flex-1">{e.word}</span>
              <span className="flex items-center justify-center w-7">
                {renderSymbolPreview(e.symbol)}
              </span>
              <span className="text-xs text-gray-400 w-8 text-right">{e.count}x</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
