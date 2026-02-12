import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchChapter } from "../lib/api";
import { getBookById, BOOKS } from "../lib/books";
import { BibleText } from "../components/BibleText";
import { useSelectionStore } from "../store/selectionStore";
import { ChapterNav } from "../components/ChapterNav";
import { BookSelector } from "../components/BookSelector";
import { CommandPalette } from "../components/CommandPalette";
import { BottomToolbar } from "../components/BottomToolbar";
import { Glossary } from "../components/Glossary";
import { KeyboardShortcuts } from "../components/KeyboardShortcuts";
import { NoteEditor } from "../components/NoteEditor";
import { AuthScreen } from "../components/AuthScreen";
import { ProfileMenu } from "../components/ProfileMenu";
import { useAuthStore } from "../store/authStore";
import { useSwipeNavigation } from "../lib/useSwipeNavigation";
import type { BibleVerse } from "../lib/types";

export function BibleReader() {
  const { translation = "nasb", book, chapter } = useParams();
  const navigate = useNavigate();
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const bookNum = Number(book);
  const chapterNum = Number(chapter);

  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const initAuth = useAuthStore((s) => s.init);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const bookInfo = getBookById(bookNum);
  const maxChapters = bookInfo?.chapters ?? 1;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchChapter(translation, bookNum, chapterNum)
      .then((data) => {
        if (!cancelled) {
          setVerses(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [translation, bookNum, chapterNum]);

  function goToChapter(b: number, c: number) {
    navigate(`/${translation}/${b}/${c}`);
  }

  function goToPrev() {
    if (chapterNum > 1) {
      goToChapter(bookNum, chapterNum - 1);
    } else {
      const prevBook = BOOKS.find((bk) => bk.id === bookNum - 1);
      if (prevBook) {
        goToChapter(prevBook.id, prevBook.chapters);
      }
    }
  }

  function goToNext() {
    if (chapterNum < maxChapters) {
      goToChapter(bookNum, chapterNum + 1);
    } else {
      const nextBook = BOOKS.find((bk) => bk.id === bookNum + 1);
      if (nextBook) {
        goToChapter(nextBook.id, 1);
      }
    }
  }

  const hasPrev = chapterNum > 1 || bookNum > 1;
  const hasNext = chapterNum < maxChapters || bookNum < 66;

  const swipe = useSwipeNavigation(
    hasPrev ? goToPrev : undefined,
    hasNext ? goToNext : undefined
  );

  return (
    <div className="min-h-screen bg-[#fafaf8]" onClick={() => clearSelection()}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#fafaf8]/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <BookSelector
            bookId={bookNum}
            chapter={chapterNum}
            translation={translation}
            onNavigate={goToChapter}
          />
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <button
              onClick={() => {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                  })
                );
              }}
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors border-none cursor-pointer"
            >
              <kbd className="text-[10px]">&#8984;K</kbd>
              <span>Search</span>
            </button>
            <span className="uppercase tracking-wider font-medium">
              {translation}
            </span>
            <ProfileMenu onSignIn={() => setAuthOpen(true)} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
        {loading && <LoadingSkeleton />}
        {error && (
          <div className="text-red-600 text-center py-12">
            <p className="text-lg font-medium">Failed to load chapter</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <BibleText
            verses={verses}
            translation={translation}
            book={bookNum}
            chapter={chapterNum}
            onPrevChapter={hasPrev ? goToPrev : undefined}
            onNextChapter={hasNext ? goToNext : undefined}
          />
        )}
      </main>

      {/* Chapter navigation - positioned above toolbar */}
      <ChapterNav
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={goToPrev}
        onNext={goToNext}
      />

      <CommandPalette />
      <BottomToolbar onOpenGlossary={() => setGlossaryOpen(true)} onOpenNotes={() => setNotesOpen(true)} />
      <Glossary open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      <KeyboardShortcuts />
      <NoteEditor
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        translation={translation}
        book={bookNum}
        chapter={chapterNum}
      />
      <AuthScreen open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div
            className="h-4 bg-gray-200 rounded"
            style={{ width: `${60 + Math.random() * 35}%` }}
          />
          <div
            className="h-4 bg-gray-200 rounded"
            style={{ width: `${40 + Math.random() * 45}%` }}
          />
        </div>
      ))}
    </div>
  );
}
