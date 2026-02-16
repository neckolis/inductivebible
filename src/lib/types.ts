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

export interface WordStudyEntry {
  word: string;
  strongs: string;
  lexeme: string;
  transliteration: string;
  pronunciation: string;
  shortDefinition: string;
  definition: string;
}
