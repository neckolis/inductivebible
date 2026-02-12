import type { BibleVerse } from "./types";

export async function fetchChapter(
  translation: string,
  book: number,
  chapter: number
): Promise<BibleVerse[]> {
  const res = await fetch(`/api/bible/${translation.toUpperCase()}/${book}/${chapter}/`);
  if (!res.ok) {
    throw new Error(`Failed to fetch chapter: ${res.status}`);
  }
  return res.json();
}
