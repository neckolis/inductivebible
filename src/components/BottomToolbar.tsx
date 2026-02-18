import { useState, useEffect, lazy, Suspense } from "react";
import {
  Highlighter,
  Sticker,
  TextUnderline,
  Eraser,
} from "../lib/icons";
import { useSelectionStore } from "../store/selectionStore";
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

export function BottomToolbar() {
  const { anchor, focus } = useSelectionStore();
  const selectedWords = useSelectionStore((s) => s.selectedWords);
  const selectedWordTexts = useSelectionStore((s) => s.selectedWordTexts);
  const { addMarkingBatch, removeMarkingBatch, markings } = useMarkingStore();
  const { addSymbol, recordUsage } = useSymbolStore();
  const recordMemory = useMemoryStore((s) => s.record);
  const activeColor = useToolStore((s) => s.activeColor);
  const [activeTab, setActiveTab] = useState<Tab>(null);
  const [underlineStyle, setUnderlineStyle] =
    useState<(typeof UNDERLINE_STYLES)[number]>("single");

  const hasSelection = !!anchor && !!focus;
  const getAllSuggestions = useMemoryStore((s) => s.getAllSuggestions);

  // Close expanded panel when selection is cleared
  useEffect(() => {
    if (!hasSelection) {
      setActiveTab(null);
    }
  }, [hasSelection]);

  function applyHighlight(color: string) {
    const words = selectedWords;
    if (words.length === 0) return;
    addMarkingBatch(words, "highlight", color);
  }

  function applySymbol(symbolValue: string) {
    const words = selectedWords;
    if (words.length === 0) return;
    addMarkingBatch(words, "symbol", symbolValue);
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
  }

  function applyUnderline(style: string, color: string) {
    const words = selectedWords;
    if (words.length === 0) return;
    addMarkingBatch(words, "underline", `${style}:${color}`);
  }

  function cycleUnderline() {
    const words = selectedWords;
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
        removeMarkingBatch(words, "underline");
        return;
      }
    }
    addMarkingBatch(words, "underline", `${nextStyle}:${activeColor}`);
  }

  function removeFromSelection() {
    const words = selectedWords.filter(
      (w) => markings[`${w.verse}:${w.wordIndex}`]
    );
    if (words.length > 0) removeMarkingBatch(words);
  }

  function toggleTab(tab: Tab) {
    if (!hasSelection) return;
    setActiveTab((prev) => (prev === tab ? null : tab));
  }

  // Handle color selection based on active tab
  function handleColorSelect(color: string) {
    if (activeTab === "highlight") {
      applyHighlight(color);
    } else if (activeTab === "underline") {
      applyUnderline(underlineStyle, color);
    }
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
        if (activeTab) {
          setActiveTab(null);
          e.preventDefault();
          return;
        }
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
          removeFromSelection();
        }
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (hasSelection) {
          e.preventDefault();
          removeFromSelection();
        }
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
  }, [activeTab, hasSelection, markings, activeColor, selectedWordTexts, getAllSuggestions]);

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

      {/* Tab row */}
      <div className="flex">
        <button
          onClick={() => toggleTab("highlight")}
          disabled={!hasSelection}
          className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors border-none cursor-pointer disabled:opacity-30 disabled:cursor-default ${
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
          disabled={!hasSelection}
          className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors border-none cursor-pointer disabled:opacity-30 disabled:cursor-default ${
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
          disabled={!hasSelection}
          className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors border-none cursor-pointer disabled:opacity-30 disabled:cursor-default ${
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
          onClick={removeFromSelection}
          disabled={!hasSelection}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-gray-500 bg-transparent hover:bg-gray-50 transition-colors border-none cursor-pointer disabled:opacity-30 disabled:cursor-default"
        >
          <Eraser size={16} />
          <span className="hidden sm:inline">Remove</span>
        </button>
      </div>
    </div>
  );
}
