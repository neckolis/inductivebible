import { useState, useEffect, lazy, Suspense } from "react";
import {
  Highlighter,
  Sticker,
  TextUnderline,
  Eraser,
  BookOpen,
  NotePencil,
} from "../lib/icons";
import { ArrowBendUpRight } from "@phosphor-icons/react";
import {
  useSelectionStore,
  getSelectionRange,
  isWordInRange,
} from "../store/selectionStore";
import { useMarkingStore } from "../store/markingStore";
import { useSymbolStore } from "../store/symbolStore";
import { useMemoryStore } from "../store/memoryStore";
import { useToolStore } from "../store/toolStore";
import { parseSymbolValue } from "../lib/storage";
import { ColorSelector } from "./ColorSelector";

// Preload allIcons in background so symbols render without opening the picker
import("../lib/allIcons");

const LazyIconPicker = lazy(() =>
  import("./IconPicker").then((m) => ({ default: m.IconPicker }))
);

const UNDERLINE_STYLES = ["single", "double", "wavy"] as const;
const UNDERLINE_CYCLE = ["single", "double", "wavy"];

type Tab = "highlight" | "symbol" | "underline" | null;

interface Props {
  onOpenGlossary: () => void;
  onOpenNotes: () => void;
}

export function BottomToolbar({ onOpenGlossary, onOpenNotes }: Props) {
  const { anchor, focus } = useSelectionStore();
  const selectedWordTexts = useSelectionStore((s) => s.selectedWordTexts);
  const { addMarking, removeMarking, markings } = useMarkingStore();
  const { addSymbol, recordUsage } = useSymbolStore();
  const recordMemory = useMemoryStore((s) => s.record);
  const { paintBrush, setPaintBrush, clearPaintBrush, activeColor, arrowMode, setArrowMode, arrowSource, arrowStyle, setArrowStyle, arrowHeadStyle, setArrowHeadStyle } =
    useToolStore();
  const [activeTab, setActiveTab] = useState<Tab>(null);
  const [underlineStyle, setUnderlineStyle] =
    useState<(typeof UNDERLINE_STYLES)[number]>("single");

  const hasSelection = !!anchor && !!focus;
  const getAllSuggestions = useMemoryStore((s) => s.getAllSuggestions);

  // Auto-open symbol tab when a word is selected
  useEffect(() => {
    if (hasSelection) {
      setActiveTab("symbol");
    }
  }, [hasSelection]);

  function getSelectedWords() {
    if (!anchor || !focus) return [];
    const [start, end] = getSelectionRange(anchor, focus);
    const words: { verse: number; wordIndex: number }[] = [];
    for (let v = start.verse; v <= end.verse; v++) {
      const startW = v === start.verse ? start.wordIndex : 0;
      const endW = v === end.verse ? end.wordIndex : 200;
      for (let w = startW; w <= endW; w++) {
        if (isWordInRange({ verse: v, wordIndex: w }, start, end)) {
          words.push({ verse: v, wordIndex: w });
        }
      }
    }
    return words;
  }

  function applyHighlight(color: string) {
    const words = getSelectedWords();
    if (words.length > 0) {
      const allSame = words.every(
        (w) =>
          markings[`${w.verse}:${w.wordIndex}`]?.highlight?.value === color
      );
      if (allSame) {
        for (const w of words) removeMarking(w.verse, w.wordIndex, "highlight");
      } else {
        for (const w of words)
          addMarking(w.verse, w.wordIndex, "highlight", color);
      }
    } else {
      setPaintBrush("highlight", color);
    }
  }

  function applySymbol(symbolValue: string) {
    const words = getSelectedWords();
    if (words.length > 0) {
      for (const w of words) {
        addMarking(w.verse, w.wordIndex, "symbol", symbolValue);
      }
      // Record word→symbol associations for smart suggestions
      for (const text of selectedWordTexts) {
        recordMemory(text, symbolValue);
      }
      const parsed = parseSymbolValue(symbolValue);
      if (parsed) {
        if (
          !useSymbolStore
            .getState()
            .symbols.some(
              (s) =>
                s.icon === parsed.icon &&
                s.color === parsed.color &&
                s.weight === parsed.weight
            )
        ) {
          addSymbol(parsed.icon, "Custom", parsed.color, parsed.weight);
        }
        recordUsage(parsed.icon, parsed.color, parsed.weight);
      }
    } else {
      setPaintBrush("symbol", symbolValue);
    }
  }

  function applyUnderline(style: string, color: string) {
    const words = getSelectedWords();
    const val = `${style}:${color}`;
    if (words.length > 0) {
      const allSame = words.every(
        (w) => markings[`${w.verse}:${w.wordIndex}`]?.underline?.value === val
      );
      if (allSame) {
        for (const w of words)
          removeMarking(w.verse, w.wordIndex, "underline");
      } else {
        for (const w of words)
          addMarking(w.verse, w.wordIndex, "underline", val);
      }
    } else {
      setPaintBrush("underline", val);
    }
  }

  function cycleUnderline() {
    const words = getSelectedWords();
    if (words.length === 0) return;
    const firstKey = `${words[0].verse}:${words[0].wordIndex}`;
    const existing = markings[firstKey];
    let nextStyle = "single";
    if (existing?.underline) {
      const currentStyle = existing.underline.value.split(":")[0];
      const idx = UNDERLINE_CYCLE.indexOf(currentStyle);
      if (idx >= 0 && idx < UNDERLINE_CYCLE.length - 1) {
        nextStyle = UNDERLINE_CYCLE[idx + 1];
      } else {
        for (const w of words)
          removeMarking(w.verse, w.wordIndex, "underline");
        return;
      }
    }
    for (const w of words) {
      addMarking(
        w.verse,
        w.wordIndex,
        "underline",
        `${nextStyle}:${activeColor}`
      );
    }
  }

  function removeFromSelection() {
    const words = getSelectedWords();
    for (const w of words) {
      if (markings[`${w.verse}:${w.wordIndex}`]) {
        removeMarking(w.verse, w.wordIndex);
      }
    }
  }

  function toggleTab(tab: Tab) {
    setActiveTab((prev) => (prev === tab ? null : tab));
  }

  // Handle color selection based on active tab
  function handleColorSelect(color: string) {
    if (activeTab === "highlight") {
      applyHighlight(color);
    } else if (activeTab === "underline") {
      applyUnderline(underlineStyle, color);
    }
    // For symbol tab, color change is handled automatically via toolStore
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (arrowMode) {
          setArrowMode(false);
          e.preventDefault();
          return;
        }
        if (paintBrush) {
          clearPaintBrush();
          e.preventDefault();
          return;
        }
        if (activeTab) {
          setActiveTab(null);
          e.preventDefault();
          return;
        }
      }

      if ((e.key === "a" || e.key === "A") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setArrowMode(!arrowMode);
      }

      if (e.key === "h" || e.key === "H") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          toggleTab("highlight");
        }
      }

      if (e.key === "s" || e.key === "S") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          toggleTab("symbol");
        }
      }

      if (e.key === "u") {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          cycleUnderline();
        } else {
          e.preventDefault();
          toggleTab("underline");
        }
      }

      if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey) {
        if (hasSelection) {
          e.preventDefault();
          const words = getSelectedWords();
          for (const w of words) removeMarking(w.verse, w.wordIndex);
        }
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (hasSelection) {
          e.preventDefault();
          removeFromSelection();
        }
      }

      if ((e.key === "g" || e.key === "G") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onOpenGlossary();
      }

      if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onOpenNotes();
      }

      // Enter: quick-apply first suggestion
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && hasSelection) {
        const suggestions = getAllSuggestions(selectedWordTexts);
        if (suggestions.length > 0) {
          e.preventDefault();
          applySymbol(suggestions[0].symbol);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, paintBrush, arrowMode, hasSelection, markings, activeColor, selectedWordTexts, getAllSuggestions]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 safe-area-bottom"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Expanded panel */}
      {activeTab && (
        <div className="px-3 py-2 border-b border-gray-100">
          {/* Tool-specific content */}
          {activeTab === "symbol" && (
            <Suspense
              fallback={
                <div className="h-28 flex items-center justify-center text-gray-400 text-xs">
                  Loading icons...
                </div>
              }
            >
              <LazyIconPicker onSelect={applySymbol} />
            </Suspense>
          )}

          {activeTab === "underline" && (
            <div className="flex items-center gap-2 justify-center mb-1.5">
              {UNDERLINE_STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() => {
                    setUnderlineStyle(style);
                    applyUnderline(style, activeColor);
                  }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/marking",
                      JSON.stringify({
                        type: "underline",
                        value: `${style}:${activeColor}`,
                      })
                    );
                  }}
                  className={`px-4 py-1.5 text-sm rounded transition-colors border-none cursor-pointer ${
                    underlineStyle === style
                      ? "bg-blue-50"
                      : "bg-transparent hover:bg-gray-100"
                  }`}
                  title={style}
                >
                  <span
                    className={`${
                      style === "single"
                        ? "underline"
                        : style === "double"
                        ? "underline decoration-double"
                        : "underline decoration-wavy"
                    }`}
                    style={{ textDecorationColor: activeColor }}
                  >
                    abc
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Color selector for highlight/underline (symbol has its own) */}
          {activeTab !== "symbol" && (
            <ColorSelector onSelect={handleColorSelect} />
          )}
        </div>
      )}

      {/* Arrow mode style picker */}
      {arrowMode && (
        <div className="px-3 py-2 border-b border-gray-100">
          {/* Line style row */}
          <div className="flex items-center gap-2 justify-center mb-2">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide mr-1">Line</span>
            {(["solid", "dashed", "dotted"] as const).map((style) => (
              <button
                key={style}
                onClick={() => setArrowStyle(style)}
                className={`px-3 py-1 rounded transition-colors border-none cursor-pointer flex items-center gap-1.5 ${
                  arrowStyle === style
                    ? "bg-amber-50"
                    : "bg-transparent hover:bg-gray-100"
                }`}
                title={style}
              >
                <svg width="36" height="12" viewBox="0 0 36 12">
                  <line
                    x1="2" y1="6" x2="28" y2="6"
                    stroke={activeColor}
                    strokeWidth={2}
                    strokeDasharray={
                      style === "dashed" ? "6 3" :
                      style === "dotted" ? "2 2" :
                      undefined
                    }
                  />
                  <polygon points="26 2, 34 6, 26 10" fill={activeColor} />
                </svg>
              </button>
            ))}
          </div>
          {/* Head style row */}
          <div className="flex items-center gap-2 justify-center mb-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide mr-1">Head</span>
            {(["end", "both", "start", "none"] as const).map((hs) => {
              const labels: Record<string, string> = {
                end: "A \u2192 B",
                start: "A \u2190 B",
                both: "A \u2194 B",
                none: "A \u2014 B",
              };
              return (
                <button
                  key={hs}
                  onClick={() => setArrowHeadStyle(hs)}
                  className={`px-3 py-1 text-xs rounded transition-colors border-none cursor-pointer ${
                    arrowHeadStyle === hs
                      ? "bg-amber-50 text-amber-700"
                      : "bg-transparent text-gray-500 hover:bg-gray-100"
                  }`}
                  title={hs}
                >
                  {labels[hs]}
                </button>
              );
            })}
          </div>
          <ColorSelector onSelect={() => {}} />
        </div>
      )}

      {/* Paint brush indicator */}
      {paintBrush && (
        <div className="flex items-center justify-center gap-2 px-3 py-1 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
          <span>Paint mode: tap words to apply</span>
          <button
            onClick={clearPaintBrush}
            className="text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer underline text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Arrow mode indicator */}
      {arrowMode && (
        <div className="flex items-center justify-center gap-2 px-3 py-1 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
          <span>{arrowSource ? "Tap target word" : "Tap source word, or click arrow to remove"}</span>
          <button
            onClick={() => setArrowMode(false)}
            className="text-amber-500 hover:text-amber-700 bg-transparent border-none cursor-pointer underline text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tab row */}
      <div className="flex">
        <button
          onClick={() => toggleTab("highlight")}
          className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors border-none cursor-pointer ${
            activeTab === "highlight"
              ? "text-blue-600 bg-blue-50"
              : "text-gray-500 bg-transparent hover:bg-gray-50"
          }`}
        >
          <Highlighter
            size={16}
            weight={activeTab === "highlight" ? "fill" : "regular"}
          />
          <span className="hidden sm:inline">Highlight</span>
        </button>

        <button
          onClick={() => toggleTab("symbol")}
          className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors border-none cursor-pointer ${
            activeTab === "symbol"
              ? "text-blue-600 bg-blue-50"
              : "text-gray-500 bg-transparent hover:bg-gray-50"
          }`}
        >
          <Sticker
            size={16}
            weight={activeTab === "symbol" ? "fill" : "regular"}
          />
          <span className="hidden sm:inline">Symbol</span>
        </button>

        <button
          onClick={() => toggleTab("underline")}
          className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors border-none cursor-pointer ${
            activeTab === "underline"
              ? "text-blue-600 bg-blue-50"
              : "text-gray-500 bg-transparent hover:bg-gray-50"
          }`}
        >
          <TextUnderline
            size={16}
            weight={activeTab === "underline" ? "fill" : "regular"}
          />
          <span className="hidden sm:inline">Underline</span>
        </button>

        <button
          onClick={() => setArrowMode(!arrowMode)}
          className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors border-none cursor-pointer ${
            arrowMode
              ? "text-amber-600 bg-amber-50"
              : "text-gray-500 bg-transparent hover:bg-gray-50"
          }`}
        >
          <ArrowBendUpRight
            size={16}
            weight={arrowMode ? "fill" : "regular"}
          />
          <span className="hidden sm:inline">Arrow</span>
        </button>

        <button
          onClick={removeFromSelection}
          disabled={!hasSelection}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-gray-500 bg-transparent hover:bg-gray-50 transition-colors border-none cursor-pointer disabled:opacity-30"
        >
          <Eraser size={16} />
          <span className="hidden sm:inline">Remove</span>
        </button>

        <button
          onClick={onOpenNotes}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-gray-500 bg-transparent hover:bg-gray-50 transition-colors border-none cursor-pointer"
        >
          <NotePencil size={16} />
          <span className="hidden sm:inline">Notes</span>
        </button>

        <button
          onClick={onOpenGlossary}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-gray-500 bg-transparent hover:bg-gray-50 transition-colors border-none cursor-pointer"
        >
          <BookOpen size={16} />
          <span className="hidden sm:inline">Glossary</span>
        </button>
      </div>
    </div>
  );
}
