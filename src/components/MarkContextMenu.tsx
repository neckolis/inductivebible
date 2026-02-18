import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMarkingStore } from "../store/markingStore";
import { parseSymbolValue, type WordMarkings } from "../lib/storage";
import { getIconComponent } from "../lib/icons";

interface Props {
  x: number;
  y: number;
  verse: number;
  wordIndex: number;
  marking: WordMarkings;
  onClose: () => void;
  onClearChapter: () => void;
}

export function MarkContextMenu({
  x,
  y,
  verse,
  wordIndex,
  marking,
  onClose,
  onClearChapter,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { removeMarking, clearVerse, clearSymbolInChapter } = useMarkingStore();
  const [pos, setPos] = useState({ top: y, left: x });

  // Clamp to viewport after render
  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pad = 8;
    let top = y;
    let left = x;
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    setPos({ top, left });
  }, [x, y]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const hasMultipleLayers = [marking.highlight, marking.underline, marking.symbol].filter(Boolean).length > 1;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Per-layer remove options */}
      {marking.highlight && (
        <button
          onClick={() => {
            removeMarking(verse, wordIndex, "highlight");
            onClose();
          }}
          className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 bg-transparent border-none cursor-pointer"
        >
          Remove highlight
        </button>
      )}
      {marking.underline && (
        <button
          onClick={() => {
            removeMarking(verse, wordIndex, "underline");
            onClose();
          }}
          className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 bg-transparent border-none cursor-pointer"
        >
          Remove underline
        </button>
      )}
      {marking.symbol && (
        <button
          onClick={() => {
            removeMarking(verse, wordIndex, "symbol");
            onClose();
          }}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 bg-transparent border-none cursor-pointer flex items-center gap-1.5"
        >
          Remove symbol{" "}
          {(() => {
            const parsed = parseSymbolValue(marking.symbol!.value);
            if (!parsed) return marking.symbol!.value;
            const Icon = getIconComponent(parsed.icon);
            if (!Icon) return parsed.icon;
            return <Icon size={16} color={parsed.color} weight={parsed.weight as "fill"} />;
          })()}
        </button>
      )}
      {hasMultipleLayers && (
        <button
          onClick={() => {
            removeMarking(verse, wordIndex);
            onClose();
          }}
          className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 bg-transparent border-none cursor-pointer"
        >
          Remove all marks
        </button>
      )}

      <div className="h-px bg-gray-100 my-1" />

      <button
        onClick={() => {
          clearVerse(verse);
          onClose();
        }}
        className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 bg-transparent border-none cursor-pointer"
      >
        Clear all marks in verse {verse}
      </button>
      {marking.symbol && (
        <button
          onClick={() => {
            clearSymbolInChapter(marking.symbol!.value);
            onClose();
          }}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 bg-transparent border-none cursor-pointer flex items-center gap-1.5"
        >
          Clear all{" "}
          {(() => {
            const parsed = parseSymbolValue(marking.symbol!.value);
            if (!parsed) return marking.symbol!.value;
            const Icon = getIconComponent(parsed.icon);
            if (!Icon) return parsed.icon;
            return <Icon size={16} color={parsed.color} weight={parsed.weight as "fill"} />;
          })()}{" "}
          in chapter
        </button>
      )}
      <div className="h-px bg-gray-100 my-1" />
      <button
        onClick={() => {
          onClearChapter();
          onClose();
        }}
        className="block w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 bg-transparent border-none cursor-pointer"
      >
        Clear all marks in chapter
      </button>
    </div>
  );
}
