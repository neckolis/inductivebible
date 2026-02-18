import { useEffect, useState, useRef } from "react";
import {
  useSelectionStore,
  getSelectionRange,
} from "../store/selectionStore";
import type { WordStudyEntry } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  book: number;
  chapter: number;
}

/** Parse KJV text Strong's tags: word<S>number</S> */
function parseKjvStrongs(
  text: string,
  isOT: boolean
): { word: string; strongs: string }[] {
  const results: { word: string; strongs: string }[] = [];
  const regex = /(\S+?)<S>([^<]+)<\/S>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const word = match[1].replace(/[^a-zA-Z']/g, "").toLowerCase();
    let num = match[2].trim();
    if (/^\d+$/.test(num)) {
      num = (isOT ? "H" : "G") + num;
    }
    if (word) {
      results.push({ word, strongs: num.toUpperCase() });
    }
  }
  return results;
}

/** Clean definition HTML into structured lines */
function parseDefinition(html: string): string[] {
  // Strip the "- Original: ..." / "- Transliteration: ..." / "- Phonetic: ..." preamble
  // and the "- Definition:" label — we show those separately
  let cleaned = html
    .replace(/-\s*Original:.*?(?=<p|$)/is, "")
    .replace(/-\s*Transliteration:.*?(?=<p|$)/is, "")
    .replace(/-\s*Phonetic:.*?(?=<p|$)/is, "")
    .replace(/-\s*Definition:\s*/i, "");

  // Replace <p>, <p />, <br> with newlines
  cleaned = cleaned.replace(/<p\s*\/?>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining HTML but keep text
  cleaned = cleaned.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
  // Collapse whitespace within lines but preserve newlines
  const lines = cleaned
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
  return lines;
}

function extractEntry(
  raw: Record<string, unknown>,
  word: string,
  strongs: string
): WordStudyEntry {
  const defHtml = String(raw.definition ?? "");
  const defLines = parseDefinition(defHtml);
  const apiShortDef = String(raw.short_definition ?? "").trim();

  return {
    word,
    strongs,
    lexeme: String(raw.lexeme ?? ""),
    transliteration: String(raw.transliteration ?? ""),
    pronunciation: String(raw.pronunciation ?? ""),
    shortDefinition: apiShortDef,
    definition: defLines.join("\n"),
  };
}

function DictEntry({ entry }: { entry: WordStudyEntry }) {
  const isGreek = entry.strongs.startsWith("G");
  const isHebrew = entry.strongs.startsWith("H");

  const defLines = entry.definition.split("\n").filter(Boolean);

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      {/* Top bar: Strong's badge + language */}
      <div className="flex items-center gap-2 mb-2">
        {entry.strongs && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isGreek
                ? "bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200"
                : isHebrew
                ? "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200"
                : "bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-200"
            }`}
          >
            {entry.strongs}
          </span>
        )}
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">
          {isGreek ? "Greek" : isHebrew ? "Hebrew" : ""}
        </span>
      </div>

      {/* Original word block */}
      {entry.lexeme && (
        <div className="mb-3">
          <div className="text-2xl text-gray-900 mb-0.5">{entry.lexeme}</div>
          <div className="flex items-baseline gap-3 text-sm">
            {entry.transliteration && (
              <span className="italic text-gray-600">{entry.transliteration}</span>
            )}
            {entry.pronunciation && (
              <span className="text-gray-400 text-xs">/{entry.pronunciation}/</span>
            )}
          </div>
        </div>
      )}

      {/* Gloss / short definition */}
      {entry.shortDefinition && (
        <div className="mb-3 px-3 py-1.5 bg-gray-50 rounded-lg">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Gloss </span>
          <span className="text-sm font-medium text-gray-800">{entry.shortDefinition}</span>
        </div>
      )}

      {/* Full definition */}
      {defLines.length > 0 && (
        <div className="space-y-1 text-[13px] leading-relaxed text-gray-700">
          {defLines.slice(0, 20).map((line, i) => {
            // Detect numbered/lettered definition lines like "1." "a." "2a."
            const isNumbered = /^(\d+[a-z]?|[a-z])\.\s/.test(line);
            return (
              <p
                key={i}
                className={isNumbered ? "pl-3" : ""}
              >
                {isNumbered ? (
                  <>
                    <span className="font-semibold text-gray-500">
                      {line.match(/^(\d+[a-z]?|[a-z])\./)?.[0]}
                    </span>
                    {" "}
                    <span>{line.replace(/^(\d+[a-z]?|[a-z])\.\s*/, "")}</span>
                  </>
                ) : (
                  line
                )}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Glossary({ open, onClose, book, chapter }: Props) {
  const [entries, setEntries] = useState<WordStudyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const anchor = useSelectionStore((s) => s.anchor);
  const focus = useSelectionStore((s) => s.focus);
  const selectedWordTexts = useSelectionStore((s) => s.selectedWordTexts);
  const fetchIdRef = useRef(0);

  // Snapshot selection data when modal opens, then fetch
  useEffect(() => {
    if (!open) {
      setEntries([]);
      setLoading(false);
      return;
    }

    if (!anchor || !focus || selectedWordTexts.length === 0) return;

    const [start, end] = getSelectionRange(anchor, focus);
    const isOT = book <= 39;
    const words = [...selectedWordTexts]; // snapshot
    const id = ++fetchIdRef.current;

    setLoading(true);
    setEntries([]);

    (async () => {
      try {
        // 1. Fetch KJV chapter to get Strong's numbers
        const kjvRes = await fetch(`/api/bible/KJV/${book}/${chapter}/`);
        if (!kjvRes.ok || id !== fetchIdRef.current) { setLoading(false); return; }
        const kjvVerses = (await kjvRes.json()) as { verse: number; text: string }[];

        // 2. Build word→Strong's mapping from selected verses
        const wordToStrongs = new Map<string, string>();
        for (const v of kjvVerses) {
          if (v.verse >= start.verse && v.verse <= end.verse) {
            for (const { word, strongs } of parseKjvStrongs(v.text, isOT)) {
              if (!wordToStrongs.has(word)) {
                wordToStrongs.set(word, strongs);
              }
            }
          }
        }

        if (id !== fetchIdRef.current) return;

        // 3. For each selected word, find its Strong's number and fetch definition
        const seen = new Set<string>();
        const lookups: Promise<WordStudyEntry | null>[] = [];

        for (const rawWord of words) {
          const clean = rawWord.replace(/[^a-zA-Z']/g, "").toLowerCase();
          if (!clean || clean.length < 2) continue;

          const strongs = wordToStrongs.get(clean);
          if (!strongs || seen.has(strongs)) continue;
          seen.add(strongs);

          lookups.push(
            fetch(`/api/dict/${encodeURIComponent(strongs)}/`)
              .then(async (res) => {
                if (!res.ok) return null;
                const data = await res.json();
                if (!Array.isArray(data) || data.length === 0) return null;
                return extractEntry(data[0], rawWord, strongs);
              })
              .catch(() => null)
          );
        }

        const results = await Promise.all(lookups);
        if (id === fetchIdRef.current) {
          setEntries(results.filter((r): r is WordStudyEntry => r !== null));
          setLoading(false);
        }
      } catch {
        if (id === fetchIdRef.current) setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const hasSelection = anchor && focus && selectedWordTexts.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full mx-4 max-h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Dictionary</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {!hasSelection && (
            <p className="text-sm text-gray-400 text-center py-8">
              Select a word or phrase in the text, then open the dictionary to
              see its Greek or Hebrew definition.
            </p>
          )}

          {hasSelection && loading && (
            <div className="space-y-4 py-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="flex gap-2">
                    <div className="h-4 w-16 bg-gray-200 rounded" />
                    <div className="h-4 w-10 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-5 w-20 bg-gray-200 rounded" />
                  <div className="h-3 w-full bg-gray-200 rounded" />
                  <div className="h-3 w-3/4 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          )}

          {hasSelection && !loading && entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              No dictionary entries found for the selected words.
            </p>
          )}

          {entries.length > 0 && (
            <div className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <DictEntry
                  key={entry.strongs || entry.word}
                  entry={entry}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
