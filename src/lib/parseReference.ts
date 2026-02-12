import { getBookByAbbrev, BOOKS } from "./books";

export interface ParsedReference {
  book: number;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

/**
 * Parse a verse reference string like "John 3:16", "Jn 3:16", "Genesis 1",
 * "Gen 1", "Romans 8:28-30", "1 Cor 13"
 */
export function parseReference(input: string): ParsedReference | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match pattern: [optional number] [book name] [chapter][:verse[-verse]]
  const match = trimmed.match(
    /^(\d?\s*[a-zA-Z]+(?:\s+of\s+[a-zA-Z]+)?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/
  );

  if (!match) {
    // Try just a book name
    const bookOnly = getBookByAbbrev(trimmed);
    if (bookOnly) {
      return { book: bookOnly.id, chapter: 1 };
    }
    return null;
  }

  const bookStr = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const verseStart = match[3] ? parseInt(match[3], 10) : undefined;
  const verseEnd = match[4] ? parseInt(match[4], 10) : undefined;

  const book = getBookByAbbrev(bookStr);
  if (!book) return null;

  if (chapter < 1 || chapter > book.chapters) return null;

  return {
    book: book.id,
    chapter,
    verseStart,
    verseEnd,
  };
}

/**
 * Get book name suggestions matching partial input
 */
export function suggestBooks(query: string): typeof BOOKS {
  const q = query.toLowerCase().trim();
  if (!q) return BOOKS.slice(0, 10);

  return BOOKS.filter(
    (b) =>
      b.name.toLowerCase().startsWith(q) ||
      b.abbrevs.some((a) => a.startsWith(q))
  ).slice(0, 10);
}
