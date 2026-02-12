import { useEffect, useCallback, useRef, useState } from "react";
import type { BibleVerse } from "../lib/types";
import { WordSpan } from "./WordSpan";
import { MarkContextMenu } from "./MarkContextMenu";
import { ClearConfirmDialog } from "./ClearConfirmDialog";
import { UndoToast } from "./UndoToast";
import {
  useSelectionStore,
  getSelectionRange,
  isWordInRange,
  type WordId,
} from "../store/selectionStore";
import { useMarkingStore } from "../store/markingStore";
import { useToolStore } from "../store/toolStore";
import { useMemoryStore } from "../store/memoryStore";
import { useSymbolStore } from "../store/symbolStore";
import { hasAnyMarking, type WordMarkings, parseSymbolValue } from "../lib/storage";

interface Props {
  verses: BibleVerse[];
  translation: string;
  book: number;
  chapter: number;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
}

interface WordInfo {
  verse: number;
  wordIndex: number;
  word: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  verse: number;
  wordIndex: number;
  marking: WordMarkings;
}

function parseVerseWords(verses: BibleVerse[]): WordInfo[][] {
  return verses.map((v) =>
    v.text
      .split(/\s+/)
      .filter(Boolean)
      .map((word, i) => ({
        verse: v.verse,
        wordIndex: i,
        word,
      }))
  );
}

function scrollWordIntoView(containerRef: React.RefObject<HTMLDivElement | null>, word: WordId) {
  const el = containerRef.current?.querySelector(
    `[data-verse="${word.verse}"][data-word="${word.wordIndex}"]`
  );
  if (el) {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

export function BibleText({ verses, translation, book, chapter, onPrevChapter, onNextChapter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { anchor, focus, setSelection, extendSelection, clearSelection } =
    useSelectionStore();
  const setDragging = useSelectionStore((s) => s.setDragging);
  const { loadChapter, markings, addMarking, undo, redo, clearChapter } = useMarkingStore();
  const paintBrush = useToolStore((s) => s.paintBrush);
  const recordMemory = useMemoryStore((s) => s.record);
  const { addSymbol, recordUsage } = useSymbolStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dragOverWord, setDragOverWord] = useState<string | null>(null);

  // Drag-to-select state
  const dragStateRef = useRef<{ active: boolean; startWord: WordId | null; moved: boolean }>({
    active: false,
    startWord: null,
    moved: false,
  });

  const allVerseWords = parseVerseWords(verses);

  const flatWords: WordId[] = allVerseWords.flatMap((verseWords) =>
    verseWords.map((w) => ({ verse: w.verse, wordIndex: w.wordIndex }))
  );

  useEffect(() => {
    loadChapter(translation, book, chapter);
    clearSelection();
  }, [translation, book, chapter, loadChapter, clearSelection]);

  const findFlatIndex = useCallback(
    (word: WordId) =>
      flatWords.findIndex(
        (w) => w.verse === word.verse && w.wordIndex === word.wordIndex
      ),
    [flatWords]
  );

  function findVerticalWord(direction: "up" | "down"): WordId | null {
    if (!containerRef.current || !focus) return null;

    const currentEl = containerRef.current.querySelector(
      `[data-verse="${focus.verse}"][data-word="${focus.wordIndex}"]`
    );
    if (!currentEl) return null;

    const currentRect = currentEl.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentTop = currentRect.top;

    const allWordEls = Array.from(
      containerRef.current.querySelectorAll("[data-verse][data-word]")
    ) as HTMLElement[];

    const rows: { top: number; els: HTMLElement[] }[] = [];
    for (const el of allWordEls) {
      const rect = el.getBoundingClientRect();
      const existingRow = rows.find((r) => Math.abs(r.top - rect.top) < 5);
      if (existingRow) {
        existingRow.els.push(el);
      } else {
        rows.push({ top: rect.top, els: [el] });
      }
    }
    rows.sort((a, b) => a.top - b.top);

    const currentRowIdx = rows.findIndex((r) => Math.abs(r.top - currentTop) < 5);
    if (currentRowIdx === -1) return null;

    const targetRowIdx = direction === "up" ? currentRowIdx - 1 : currentRowIdx + 1;
    if (targetRowIdx < 0 || targetRowIdx >= rows.length) return null;

    const targetRow = rows[targetRowIdx];
    let closest: HTMLElement | null = null;
    let closestDist = Infinity;
    for (const el of targetRow.els) {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const dist = Math.abs(centerX - currentCenterX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = el;
      }
    }

    if (!closest) return null;
    const verse = Number(closest.dataset.verse);
    const wordIndex = Number(closest.dataset.word);
    return { verse, wordIndex };
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Undo/Redo (always active)
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        setContextMenu(null);
        return;
      }

      if (!anchor && !focus) {
        if (e.key === "ArrowLeft" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
          onPrevChapter?.();
          return;
        }
        if (e.key === "ArrowRight" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
          onNextChapter?.();
          return;
        }
      }

      if (!anchor || !focus) return;

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIdx = findFlatIndex(focus);
        if (currentIdx === -1) return;

        const nextIdx =
          e.key === "ArrowRight"
            ? Math.min(currentIdx + 1, flatWords.length - 1)
            : Math.max(currentIdx - 1, 0);

        const nextWord = flatWords[nextIdx];
        if (e.shiftKey) {
          extendSelection(nextWord);
        } else {
          setSelection(nextWord);
        }
        scrollWordIntoView(containerRef, nextWord);
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const target = findVerticalWord(e.key === "ArrowUp" ? "up" : "down");
        if (!target) return;
        if (e.shiftKey) {
          extendSelection(target);
        } else {
          setSelection(target);
        }
        scrollWordIntoView(containerRef, target);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [anchor, focus, flatWords, findFlatIndex, setSelection, extendSelection, clearSelection, undo, redo, onPrevChapter, onNextChapter]);

  const [rangeStart, rangeEnd] =
    anchor && focus ? getSelectionRange(anchor, focus) : [null, null];

  function getWordAtPoint(x: number, y: number): { verse: number; wordIndex: number; word: string } | null {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    // Walk up to find [data-verse][data-word]
    let target: Element | null = el;
    while (target && target !== containerRef.current) {
      if (target instanceof HTMLElement && target.dataset.verse !== undefined && target.dataset.word !== undefined) {
        const verse = Number(target.dataset.verse);
        const wordIndex = Number(target.dataset.word);
        // Find the word text from allVerseWords
        const verseWords = allVerseWords.find((vw) => vw[0]?.verse === verse);
        const wordInfo = verseWords?.find((w) => w.wordIndex === wordIndex);
        return { verse, wordIndex, word: wordInfo?.word ?? "" };
      }
      target = target.parentElement;
    }
    return null;
  }

  function applyPaintToWord(verse: number, wordIndex: number, word: string) {
    if (!paintBrush) return;
    addMarking(verse, wordIndex, paintBrush.type, paintBrush.value);
    if (paintBrush.type === "symbol") {
      recordMemory(word, paintBrush.value);
      const parsed = parseSymbolValue(paintBrush.value);
      if (parsed) {
        recordUsage(parsed.icon, parsed.color, parsed.weight);
      }
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    const hit = getWordAtPoint(e.clientX, e.clientY);
    if (!hit) return;

    // Prevent native text selection and scrolling on touch
    if (e.pointerType === "touch") {
      e.preventDefault();
    }

    dragStateRef.current = { active: true, startWord: { verse: hit.verse, wordIndex: hit.wordIndex }, moved: false };
    setDragging(true);

    if (paintBrush) {
      applyPaintToWord(hit.verse, hit.wordIndex, hit.word);
    } else {
      setSelection({ verse: hit.verse, wordIndex: hit.wordIndex });
      setContextMenu(null);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStateRef.current.active) return;
    const hit = getWordAtPoint(e.clientX, e.clientY);
    if (!hit) return;

    const start = dragStateRef.current.startWord;
    if (start && (hit.verse !== start.verse || hit.wordIndex !== start.wordIndex)) {
      dragStateRef.current.moved = true;
    }

    if (paintBrush) {
      applyPaintToWord(hit.verse, hit.wordIndex, hit.word);
    } else {
      extendSelection({ verse: hit.verse, wordIndex: hit.wordIndex });
    }
  }

  function handlePointerUp() {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    setDragging(false);
  }

  function handleContextMenu(
    e: React.MouseEvent,
    verse: number,
    wordIndex: number
  ) {
    const marking = markings[`${verse}:${wordIndex}`];
    if (!marking || !hasAnyMarking(marking)) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, verse, wordIndex, marking });
  }

  function handleDragOver(e: React.DragEvent, verse: number, wordIndex: number) {
    if (e.dataTransfer.types.includes("application/marking")) {
      e.preventDefault();
      setDragOverWord(`${verse}:${wordIndex}`);
    }
  }

  function handleDragLeave() {
    setDragOverWord(null);
  }

  function handleDrop(e: React.DragEvent, verse: number, wordIndex: number, word: string) {
    e.preventDefault();
    setDragOverWord(null);
    const raw = e.dataTransfer.getData("application/marking");
    if (!raw) return;
    try {
      const { type, value } = JSON.parse(raw) as { type: string; value: string };
      addMarking(verse, wordIndex, type as "highlight" | "underline" | "symbol", value);
      if (type === "symbol") {
        recordMemory(word, value);
        const parsed = parseSymbolValue(value);
        if (parsed) {
          if (!useSymbolStore.getState().symbols.some(
            (s) => s.icon === parsed.icon && s.color === parsed.color && s.weight === parsed.weight
          )) {
            addSymbol(parsed.icon, "Custom", parsed.color, parsed.weight);
          }
          recordUsage(parsed.icon, parsed.color, parsed.weight);
        }
      }
    } catch {
      // invalid data
    }
  }

  return (
    <div
      ref={containerRef}
      className="bible-text relative"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        e.stopPropagation();
        if ((e.target as HTMLElement).dataset.verse === undefined) {
          clearSelection();
          setContextMenu(null);
        }
      }}
    >
      {allVerseWords.map((verseWords, vi) => (
        <div key={verses[vi].pk} className="mb-3">
          <sup className="verse-number">{verses[vi].verse}</sup>
          {verseWords.map((w, wi) => {
            const selected =
              rangeStart && rangeEnd
                ? isWordInRange(
                    { verse: w.verse, wordIndex: w.wordIndex },
                    rangeStart,
                    rangeEnd
                  )
                : false;
            const wordKey = `${w.verse}:${w.wordIndex}`;
            return (
              <span key={`${w.verse}-${wi}`}>
                <WordSpan
                  verse={w.verse}
                  wordIndex={w.wordIndex}
                  word={w.word}
                  isSelected={selected}
                  isDragOver={dragOverWord === wordKey}
                  onContextMenu={(e) =>
                    handleContextMenu(e, w.verse, w.wordIndex)
                  }
                  onDragOver={(e) => handleDragOver(e, w.verse, w.wordIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, w.verse, w.wordIndex, w.word)}
                />
                {wi < verseWords.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      ))}

      {contextMenu && (
        <MarkContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          verse={contextMenu.verse}
          wordIndex={contextMenu.wordIndex}
          marking={contextMenu.marking}
          onClose={() => setContextMenu(null)}
          onClearChapter={() => {
            setContextMenu(null);
            setShowClearConfirm(true);
          }}
        />
      )}

      {showClearConfirm && (
        <ClearConfirmDialog
          markings={markings}
          onConfirm={() => {
            clearChapter();
            setShowClearConfirm(false);
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      <UndoToast />
    </div>
  );
}
