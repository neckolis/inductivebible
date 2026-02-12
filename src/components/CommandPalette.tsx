import { useEffect, useState } from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useNavigate, useParams } from "react-router-dom";
import { BOOKS, getBookById } from "../lib/books";
import { parseReference } from "../lib/parseReference";
import { useMarkingStore } from "../store/markingStore";
import { useSelectionStore } from "../store/selectionStore";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { translation = "nasb", book, chapter } = useParams();
  const bookNum = Number(book);
  const chapterNum = Number(chapter);
  const clearChapter = useMarkingStore((s) => s.clearChapter);
  const { undo, redo } = useMarkingStore();
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function goTo(t: string, b: number, c: number) {
    navigate(`/${t}/${b}/${c}`);
    setOpen(false);
    setSearch("");
  }

  const parsedRef = parseReference(search);
  const currentBook = getBookById(bookNum);
  const totalChapters = currentBook?.chapters ?? 1;

  // Filter books manually so cmdk doesn't interfere
  const filteredBooks = BOOKS.filter(
    (b) =>
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.abbrevs.some((a) => a.includes(search.toLowerCase()))
  ).slice(0, 8);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-[100]"
      shouldFilter={false}
    >
      <VisuallyHidden asChild>
        <Dialog.Title>Command palette</Dialog.Title>
      </VisuallyHidden>
      <VisuallyHidden asChild>
        <Dialog.Description>
          Search for books, verses, and commands
        </Dialog.Description>
      </VisuallyHidden>
      <div
        className="fixed inset-0 bg-black/30"
        onClick={() => setOpen(false)}
      />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[101]">
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a verse, book, or command..."
          className="w-full px-4 py-3 text-base border-b border-gray-200 outline-none bg-transparent"
        />
        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-4 text-sm text-gray-400 text-center">
            No results found.
          </Command.Empty>

          {/* Parsed verse reference */}
          {parsedRef && (
            <Command.Group heading="Navigate">
              <Command.Item
                onSelect={() =>
                  goTo(translation, parsedRef.book, parsedRef.chapter)
                }
                className="px-3 py-2 text-sm rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700"
              >
                Go to {getBookById(parsedRef.book)?.name} {parsedRef.chapter}
                {parsedRef.verseStart ? `:${parsedRef.verseStart}` : ""}
                {parsedRef.verseEnd ? `-${parsedRef.verseEnd}` : ""}
              </Command.Item>
            </Command.Group>
          )}

          {/* Book navigation */}
          {!parsedRef && filteredBooks.length > 0 && (
            <Command.Group heading="Books">
              {filteredBooks.map((b) => (
                <Command.Item
                  key={b.id}
                  onSelect={() => goTo(translation, b.id, 1)}
                  className="px-3 py-2 text-sm rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700"
                >
                  {b.name}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Smart commands — show when no search or matching search */}
          {(!search || "next".includes(search.toLowerCase()) || "previous".includes(search.toLowerCase()) || "chapter".includes(search.toLowerCase())) && (
            <Command.Group heading="Chapter">
              {chapterNum < totalChapters && (
                <Command.Item
                  onSelect={() => goTo(translation, bookNum, chapterNum + 1)}
                  className="px-3 py-2 text-sm rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700"
                >
                  Next chapter ({currentBook?.name} {chapterNum + 1})
                </Command.Item>
              )}
              {chapterNum > 1 && (
                <Command.Item
                  onSelect={() => goTo(translation, bookNum, chapterNum - 1)}
                  className="px-3 py-2 text-sm rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700"
                >
                  Previous chapter ({currentBook?.name} {chapterNum - 1})
                </Command.Item>
              )}
            </Command.Group>
          )}

          {/* Translation switching */}
          {(!search || "translation".includes(search.toLowerCase()) || "switch".includes(search.toLowerCase()) || "nasb".includes(search.toLowerCase()) || "esv".includes(search.toLowerCase()) || "kjv".includes(search.toLowerCase()) || "nkjv".includes(search.toLowerCase())) && (
            <Command.Group heading="Translation">
              {[
                { code: "nasb", name: "NASB" },
                { code: "esv", name: "ESV" },
                { code: "kjv", name: "KJV" },
                { code: "nkjv", name: "NKJV" },
              ]
                .filter((t) => t.code !== translation.toLowerCase())
                .map((t) => (
                  <Command.Item
                    key={t.code}
                    onSelect={() => goTo(t.code, bookNum, chapterNum)}
                    className="px-3 py-2 text-sm rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700"
                  >
                    Switch to {t.name}
                  </Command.Item>
                ))}
            </Command.Group>
          )}

          {/* Actions */}
          {(!search || "undo".includes(search.toLowerCase()) || "redo".includes(search.toLowerCase()) || "clear".includes(search.toLowerCase()) || "selection".includes(search.toLowerCase())) && (
            <Command.Group heading="Actions">
              <Command.Item
                onSelect={() => {
                  undo();
                  setOpen(false);
                }}
                className="px-3 py-2 text-sm rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700"
              >
                Undo last action
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  redo();
                  setOpen(false);
                }}
                className="px-3 py-2 text-sm rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700"
              >
                Redo last action
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  clearSelection();
                  setOpen(false);
                }}
                className="px-3 py-2 text-sm rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700"
              >
                Clear selection
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  clearChapter();
                  setOpen(false);
                }}
                className="px-3 py-2 text-sm rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700 text-red-600"
              >
                Clear all marks in{" "}
                {currentBook?.name} {chapterNum}
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>

        <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-400 flex gap-3">
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">
              &uarr;&darr;
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">
              Enter
            </kbd>{" "}
            select
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">
              Esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}
