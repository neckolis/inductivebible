export interface BibleVerse {
  pk: number;
  verse: number;
  text: string;
}

export interface ChapterData {
  translation: string;
  book: number;
  chapter: number;
  verses: BibleVerse[];
}

export interface BookInfo {
  id: number;
  name: string;
  abbrevs: string[];
  chapters: number;
}
