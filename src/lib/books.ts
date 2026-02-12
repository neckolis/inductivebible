import type { BookInfo } from "./types";

export const BOOKS: BookInfo[] = [
  // Old Testament
  { id: 1, name: "Genesis", abbrevs: ["gen", "ge", "gn"], chapters: 50 },
  { id: 2, name: "Exodus", abbrevs: ["exo", "ex", "exod"], chapters: 40 },
  { id: 3, name: "Leviticus", abbrevs: ["lev", "le", "lv"], chapters: 27 },
  { id: 4, name: "Numbers", abbrevs: ["num", "nu", "nm", "nb"], chapters: 36 },
  { id: 5, name: "Deuteronomy", abbrevs: ["deu", "dt", "deut"], chapters: 34 },
  { id: 6, name: "Joshua", abbrevs: ["jos", "josh", "jsh"], chapters: 24 },
  { id: 7, name: "Judges", abbrevs: ["jdg", "judg", "jg"], chapters: 21 },
  { id: 8, name: "Ruth", abbrevs: ["rut", "ru", "rth"], chapters: 4 },
  { id: 9, name: "1 Samuel", abbrevs: ["1sa", "1sam", "1sm"], chapters: 31 },
  { id: 10, name: "2 Samuel", abbrevs: ["2sa", "2sam", "2sm"], chapters: 24 },
  { id: 11, name: "1 Kings", abbrevs: ["1ki", "1kgs", "1kg"], chapters: 22 },
  { id: 12, name: "2 Kings", abbrevs: ["2ki", "2kgs", "2kg"], chapters: 25 },
  { id: 13, name: "1 Chronicles", abbrevs: ["1ch", "1chr", "1chron"], chapters: 29 },
  { id: 14, name: "2 Chronicles", abbrevs: ["2ch", "2chr", "2chron"], chapters: 36 },
  { id: 15, name: "Ezra", abbrevs: ["ezr", "ez"], chapters: 10 },
  { id: 16, name: "Nehemiah", abbrevs: ["neh", "ne"], chapters: 13 },
  { id: 17, name: "Esther", abbrevs: ["est", "esth"], chapters: 10 },
  { id: 18, name: "Job", abbrevs: ["job", "jb"], chapters: 42 },
  { id: 19, name: "Psalms", abbrevs: ["psa", "ps", "psm", "pss", "psalm"], chapters: 150 },
  { id: 20, name: "Proverbs", abbrevs: ["pro", "pr", "prv", "prov"], chapters: 31 },
  { id: 21, name: "Ecclesiastes", abbrevs: ["ecc", "ec", "eccl", "eccles"], chapters: 12 },
  { id: 22, name: "Song of Solomon", abbrevs: ["sol", "sos", "song", "sg"], chapters: 8 },
  { id: 23, name: "Isaiah", abbrevs: ["isa", "is"], chapters: 66 },
  { id: 24, name: "Jeremiah", abbrevs: ["jer", "je", "jr"], chapters: 52 },
  { id: 25, name: "Lamentations", abbrevs: ["lam", "la"], chapters: 5 },
  { id: 26, name: "Ezekiel", abbrevs: ["eze", "ezk", "ezek"], chapters: 48 },
  { id: 27, name: "Daniel", abbrevs: ["dan", "da", "dn"], chapters: 12 },
  { id: 28, name: "Hosea", abbrevs: ["hos", "ho"], chapters: 14 },
  { id: 29, name: "Joel", abbrevs: ["joe", "jl", "joel"], chapters: 3 },
  { id: 30, name: "Amos", abbrevs: ["amo", "am"], chapters: 9 },
  { id: 31, name: "Obadiah", abbrevs: ["oba", "ob", "obad"], chapters: 1 },
  { id: 32, name: "Jonah", abbrevs: ["jon", "jnh"], chapters: 4 },
  { id: 33, name: "Micah", abbrevs: ["mic", "mc"], chapters: 7 },
  { id: 34, name: "Nahum", abbrevs: ["nah", "na"], chapters: 3 },
  { id: 35, name: "Habakkuk", abbrevs: ["hab", "hb"], chapters: 3 },
  { id: 36, name: "Zephaniah", abbrevs: ["zep", "zp", "zeph"], chapters: 3 },
  { id: 37, name: "Haggai", abbrevs: ["hag", "hg"], chapters: 2 },
  { id: 38, name: "Zechariah", abbrevs: ["zec", "zc", "zech"], chapters: 14 },
  { id: 39, name: "Malachi", abbrevs: ["mal", "ml"], chapters: 4 },
  // New Testament
  { id: 40, name: "Matthew", abbrevs: ["mat", "mt", "matt"], chapters: 28 },
  { id: 41, name: "Mark", abbrevs: ["mrk", "mk", "mar"], chapters: 16 },
  { id: 42, name: "Luke", abbrevs: ["luk", "lk", "lu"], chapters: 24 },
  { id: 43, name: "John", abbrevs: ["joh", "jn", "jhn"], chapters: 21 },
  { id: 44, name: "Acts", abbrevs: ["act", "ac"], chapters: 28 },
  { id: 45, name: "Romans", abbrevs: ["rom", "ro", "rm"], chapters: 16 },
  { id: 46, name: "1 Corinthians", abbrevs: ["1co", "1cor"], chapters: 16 },
  { id: 47, name: "2 Corinthians", abbrevs: ["2co", "2cor"], chapters: 13 },
  { id: 48, name: "Galatians", abbrevs: ["gal", "ga"], chapters: 6 },
  { id: 49, name: "Ephesians", abbrevs: ["eph", "ep"], chapters: 6 },
  { id: 50, name: "Philippians", abbrevs: ["phi", "php", "phil"], chapters: 4 },
  { id: 51, name: "Colossians", abbrevs: ["col", "cl"], chapters: 4 },
  { id: 52, name: "1 Thessalonians", abbrevs: ["1th", "1thess", "1thes"], chapters: 5 },
  { id: 53, name: "2 Thessalonians", abbrevs: ["2th", "2thess", "2thes"], chapters: 3 },
  { id: 54, name: "1 Timothy", abbrevs: ["1ti", "1tim"], chapters: 6 },
  { id: 55, name: "2 Timothy", abbrevs: ["2ti", "2tim"], chapters: 4 },
  { id: 56, name: "Titus", abbrevs: ["tit", "ti"], chapters: 3 },
  { id: 57, name: "Philemon", abbrevs: ["phm", "philem"], chapters: 1 },
  { id: 58, name: "Hebrews", abbrevs: ["heb", "he"], chapters: 13 },
  { id: 59, name: "James", abbrevs: ["jam", "jas", "jm"], chapters: 5 },
  { id: 60, name: "1 Peter", abbrevs: ["1pe", "1pet", "1pt"], chapters: 5 },
  { id: 61, name: "2 Peter", abbrevs: ["2pe", "2pet", "2pt"], chapters: 3 },
  { id: 62, name: "1 John", abbrevs: ["1jo", "1jn", "1jhn"], chapters: 5 },
  { id: 63, name: "2 John", abbrevs: ["2jo", "2jn", "2jhn"], chapters: 1 },
  { id: 64, name: "3 John", abbrevs: ["3jo", "3jn", "3jhn"], chapters: 1 },
  { id: 65, name: "Jude", abbrevs: ["jud", "jde"], chapters: 1 },
  { id: 66, name: "Revelation", abbrevs: ["rev", "re", "rv"], chapters: 22 },
];

const bookByIdMap = new Map(BOOKS.map((b) => [b.id, b]));

const bookByAbbrevMap = new Map<string, BookInfo>();
for (const book of BOOKS) {
  bookByAbbrevMap.set(book.name.toLowerCase(), book);
  for (const abbr of book.abbrevs) {
    bookByAbbrevMap.set(abbr, book);
  }
}

export function getBookById(id: number): BookInfo | undefined {
  return bookByIdMap.get(id);
}

export function getBookByAbbrev(abbrev: string): BookInfo | undefined {
  return bookByAbbrevMap.get(abbrev.toLowerCase());
}

export function getBookName(id: number): string {
  return bookByIdMap.get(id)?.name ?? `Book ${id}`;
}
