import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { fetchChapter } from "../lib/api";
import { getBookById, BOOKS } from "../lib/books";
import { BibleText } from "../components/BibleText";
import { useSelectionStore } from "../store/selectionStore";
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
import { TRANSLATIONS } from "../lib/translations";
import type { BibleVerse } from "../lib/types";

export function BibleReader() {
  const { translation = "NASB", book, chapter } = useParams();
  const navigate = useNavigate();
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const bookNum = Number(book);
  const chapterNum = Number(chapter);
  const [translationOpen, setTranslationOpen] = useState(false);
  const translationRef = useRef<HTMLDivElement>(null);

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

  // Close translation dropdown on click outside
  useEffect(() => {
    if (!translationOpen) return;
    function handleClick(e: MouseEvent) {
      if (translationRef.current && !translationRef.current.contains(e.target as Node)) {
        setTranslationOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [translationOpen]);

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
            <div className="relative" ref={translationRef}>
              <button
                onClick={() => setTranslationOpen((v) => !v)}
                className="uppercase tracking-wider font-medium bg-transparent border-none cursor-pointer text-gray-500 hover:text-gray-800 transition-colors px-1"
              >
                {translation}
              </button>
              {translationOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[5rem] z-50">
                  {TRANSLATIONS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTranslationOpen(false);
                        if (t.id.toLowerCase() !== translation.toLowerCase()) {
                          navigate(`/${t.id}/${bookNum}/${chapterNum}`);
                        }
                      }}
                      className={`block w-full text-left px-3 py-1.5 text-sm border-none cursor-pointer transition-colors ${
                        t.id.toLowerCase() === translation.toLowerCase()
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "bg-transparent text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
