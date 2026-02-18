import { useState, useRef, useEffect } from "react";
import { BOOKS, getBookById } from "../lib/books";

interface Props {
  bookId: number;
  chapter: number;
  translation: string;
  onNavigate: (book: number, chapter: number) => void;
}

export function BookSelector({ bookId, chapter, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const bookInfo = getBookById(bookId);
  const displayName = bookInfo
    ? `${bookInfo.name} ${chapter}`
    : `Book ${bookId} ${chapter}`;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectedBook(null);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleBookClick(id: number) {
    const book = getBookById(id);
    if (book && book.chapters === 1) {
      onNavigate(id, 1);
      setOpen(false);
      setSelectedBook(null);
    } else {
      setSelectedBook(id);
    }
  }

  function handleChapterClick(ch: number) {
    if (selectedBook) {
      onNavigate(selectedBook, ch);
      setOpen(false);
      setSelectedBook(null);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen(!open);
          setSelectedBook(null);
        }}
        className="text-lg font-semibold text-gray-900 hover:text-gray-600 transition-colors bg-transparent border-none cursor-pointer px-0"
      >
        {displayName}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-[340px] max-h-[70vh] overflow-hidden">
          {selectedBook === null ? (
            <BookList currentBookId={bookId} onSelect={handleBookClick} />
          ) : (
            <ChapterGrid
              bookId={selectedBook}
              currentChapter={selectedBook === bookId ? chapter : -1}
              onSelect={handleChapterClick}
              onBack={() => setSelectedBook(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function BookList({
  currentBookId,
  onSelect,
}: {
  currentBookId: number;
  onSelect: (id: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div className="overflow-y-auto max-h-[70vh]">
      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Old Testament
      </div>
      {BOOKS.filter((b) => b.id <= 39).map((book) => (
        <button
          key={book.id}
          ref={book.id === currentBookId ? activeRef : undefined}
          onClick={() => onSelect(book.id)}
          className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors bg-transparent border-none cursor-pointer ${
            book.id === currentBookId
              ? "text-blue-600 font-medium"
              : "text-gray-700"
          }`}
        >
          {book.name}
        </button>
      ))}
      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">
        New Testament
      </div>
      {BOOKS.filter((b) => b.id >= 40).map((book) => (
        <button
          key={book.id}
          ref={book.id === currentBookId ? activeRef : undefined}
          onClick={() => onSelect(book.id)}
          className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors bg-transparent border-none cursor-pointer ${
            book.id === currentBookId
              ? "text-blue-600 font-medium"
              : "text-gray-700"
          }`}
        >
          {book.name}
        </button>
      ))}
    </div>
  );
}

function ChapterGrid({
  bookId,
  currentChapter,
  onSelect,
  onBack,
}: {
  bookId: number;
  currentChapter: number;
  onSelect: (ch: number) => void;
  onBack: () => void;
}) {
  const book = getBookById(bookId);
  if (!book) return null;

  return (
    <div className="p-3">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-700 mb-2 bg-transparent border-none cursor-pointer px-0 flex items-center gap-1"
      >
        &larr; {book.name}
      </button>
      <div className="grid grid-cols-6 gap-1">
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => (
          <button
            key={ch}
            onClick={() => onSelect(ch)}
            className={`py-1.5 text-sm rounded transition-colors border-none cursor-pointer ${
              ch === currentChapter
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  );
}
