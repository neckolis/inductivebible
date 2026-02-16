import { useEffect, useRef } from "react";
import { useMarkingStore } from "../store/markingStore";
import { useArrowStore } from "../store/arrowStore";
import { parseSymbolValue, type WordMarkings, type ArrowConnection } from "../lib/storage";
import { getIconComponent } from "../lib/icons";

interface Props {
  x: number;
  y: number;
  verse: number;
  wordIndex: number;
  marking: WordMarkings;
  connectedArrows?: ArrowConnection[];
  onClose: () => void;
  onClearChapter: () => void;
}

export function MarkContextMenu({
  x,
  y,
  verse,
  wordIndex,
  marking,
  connectedArrows = [],
  onClose,
  onClearChapter,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { removeMarking, clearVerse, clearSymbolInChapter } = useMarkingStore();
  const removeArrow = useArrowStore((s) => s.removeArrow);

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
      style={{ top: y, left: x }}
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

      {/* Arrow removal options */}
      {connectedArrows.length > 0 && (
        <>
          {(marking.highlight || marking.underline || marking.symbol) && (
            <div className="h-px bg-gray-100 my-1" />
          )}
          {connectedArrows.map((arrow) => {
            const isFrom = arrow.fromVerse === verse && arrow.fromWord === wordIndex;
            const targetVerse = isFrom ? arrow.toVerse : arrow.fromVerse;
            const targetWord = isFrom ? arrow.toWord : arrow.fromWord;
            return (
              <button
                key={arrow.id}
                onClick={() => {
                  removeArrow(arrow.id);
                  onClose();
                }}
                className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 bg-transparent border-none cursor-pointer"
              >
                Remove arrow {isFrom ? "to" : "from"} {targetVerse}:{targetWord}
              </button>
            );
          })}
        </>
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
