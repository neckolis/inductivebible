import { useEffect, useRef, useState, useCallback } from "react";
import { useNoteStore } from "../store/noteStore";
import { SlashMenu } from "./SlashMenu";
import { getBookById } from "../lib/books";
import type { BlockType } from "../lib/noteTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  translation: string;
  book: number;
  chapter: number;
}

export function NoteEditor({ open, onClose, translation, book, chapter }: Props) {
  const { blocks, loadNotes, addBlock, updateBlock, changeBlockType, deleteBlock, toggleChecked } =
    useNoteStore();

  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; position: { top: number; left: number } } | null>(null);

  useEffect(() => {
    if (open) {
      loadNotes(translation, book, chapter);
    }
  }, [open, translation, book, chapter, loadNotes]);

  // Focus management
  useEffect(() => {
    if (focusBlockId) {
      const el = blockRefs.current.get(focusBlockId);
      if (el) {
        el.focus();
        // Place cursor at end
        const range = document.createRange();
        const sel = window.getSelection();
        if (el.childNodes.length > 0) {
          range.selectNodeContents(el);
          range.collapse(false);
        } else {
          range.setStart(el, 0);
          range.collapse(true);
        }
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setFocusBlockId(null);
    }
  }, [focusBlockId, blocks]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, blockId: string) => {
      const idx = blocks.findIndex((b) => b.id === blockId);
      const block = blocks[idx];
      if (!block) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const newId = addBlock(blockId);
        setFocusBlockId(newId);
      }

      if (e.key === "Backspace" && block.content === "") {
        e.preventDefault();
        if (blocks.length > 1) {
          const prevId = idx > 0 ? blocks[idx - 1].id : null;
          deleteBlock(blockId);
          if (prevId) setFocusBlockId(prevId);
        }
      }

      if (e.key === "ArrowUp" && idx > 0) {
        const el = blockRefs.current.get(blockId);
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            // Only move to previous block if cursor is at the top line
            if (Math.abs(rect.top - elRect.top) < 5) {
              e.preventDefault();
              setFocusBlockId(blocks[idx - 1].id);
            }
          }
        }
      }

      if (e.key === "ArrowDown" && idx < blocks.length - 1) {
        const el = blockRefs.current.get(blockId);
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            // Only move to next block if cursor is at the bottom line
            if (Math.abs(rect.bottom - elRect.bottom) < 5) {
              e.preventDefault();
              setFocusBlockId(blocks[idx + 1].id);
            }
          }
        }
      }
    },
    [blocks, addBlock, deleteBlock]
  );

  const handleInput = useCallback(
    (blockId: string, el: HTMLElement) => {
      const text = el.textContent ?? "";

      // Detect "/" typed as the entire content
      if (text === "/") {
        const rect = el.getBoundingClientRect();
        setSlashMenu({
          blockId,
          position: { top: rect.bottom + 4, left: rect.left },
        });
        return;
      }

      // Close slash menu if open for this block and text changed
      if (slashMenu?.blockId === blockId) {
        setSlashMenu(null);
      }

      updateBlock(blockId, text);
    },
    [updateBlock, slashMenu]
  );

  function handleSlashSelect(type: BlockType) {
    if (!slashMenu) return;
    const blockId = slashMenu.blockId;
    changeBlockType(blockId, type);
    // Clear the "/" from content
    updateBlock(blockId, "");
    const el = blockRefs.current.get(blockId);
    if (el) el.textContent = "";
    setSlashMenu(null);
    setFocusBlockId(blockId);
  }

  function handleStartWriting() {
    const newId = addBlock(null);
    setFocusBlockId(newId);
  }

  const bookInfo = getBookById(book);
  const bookName = bookInfo?.name ?? `Book ${book}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-[#fafaf8] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#fafaf8]/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            {bookName} {chapter} &mdash; Notes
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors bg-transparent border-none cursor-pointer"
          >
            Done
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {blocks.length === 0 ? (
            <button
              onClick={handleStartWriting}
              className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-sm transition-colors"
            >
              Start writing...
            </button>
          ) : (
            <div className="space-y-1">
              {blocks.map((block, idx) => {
                if (block.type === "divider") {
                  return (
                    <div key={block.id} className="py-2">
                      <hr className="border-gray-200" />
                    </div>
                  );
                }

                const baseClass =
                  "outline-none w-full min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300";

                let blockClass = baseClass;
                let wrapper = "";
                let prefix: React.ReactNode = null;

                switch (block.type) {
                  case "heading":
                    blockClass += " text-xl font-semibold";
                    break;
                  case "bullet":
                    wrapper = "flex gap-2 items-start";
                    prefix = <span className="text-gray-400 mt-0.5 select-none">&bull;</span>;
                    break;
                  case "numbered":
                    wrapper = "flex gap-2 items-start";
                    prefix = (
                      <span className="text-gray-400 mt-0.5 select-none min-w-[1.5em] text-right">
                        {(() => {
                          let num = 1;
                          for (let i = idx - 1; i >= 0; i--) {
                            if (blocks[i].type === "numbered") num++;
                            else break;
                          }
                          return `${num}.`;
                        })()}
                      </span>
                    );
                    break;
                  case "quote":
                    wrapper = "border-l-4 border-gray-300 pl-4 italic text-gray-600";
                    break;
                  case "callout":
                    wrapper = "bg-amber-50 rounded-lg px-4 py-3";
                    break;
                  case "todo":
                    wrapper = "flex gap-2 items-start";
                    prefix = (
                      <input
                        type="checkbox"
                        checked={block.checked ?? false}
                        onChange={() => toggleChecked(block.id)}
                        className="mt-1.5 cursor-pointer"
                      />
                    );
                    if (block.checked) {
                      blockClass += " line-through text-gray-400";
                    }
                    break;
                }

                const placeholder =
                  block.type === "text"
                    ? "Type '/' for commands..."
                    : block.type === "heading"
                    ? "Heading..."
                    : "";

                const contentEl = (
                  <div
                    ref={(el) => {
                      if (el) blockRefs.current.set(block.id, el);
                      else blockRefs.current.delete(block.id);
                    }}
                    contentEditable
                    suppressContentEditableWarning
                    className={blockClass}
                    data-placeholder={placeholder}
                    onInput={(e) => handleInput(block.id, e.currentTarget)}
                    onKeyDown={(e) => handleKeyDown(e, block.id)}
                    dangerouslySetInnerHTML={{ __html: block.content }}
                  />
                );

                if (wrapper) {
                  return (
                    <div key={block.id} className={wrapper}>
                      {prefix}
                      {contentEl}
                    </div>
                  );
                }

                return <div key={block.id}>{contentEl}</div>;
              })}
            </div>
          )}
        </div>
      </main>

      {slashMenu && (
        <SlashMenu
          position={slashMenu.position}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(null)}
        />
      )}
    </div>
  );
}
