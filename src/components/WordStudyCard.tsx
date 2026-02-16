import type { WordStudyEntry } from "../lib/types";

interface Props {
  entry: WordStudyEntry;
}

export function WordStudyCard({ entry }: Props) {
  const isGreek = entry.strongs.startsWith("G");
  const isHebrew = entry.strongs.startsWith("H");

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
      <div className="flex items-center gap-2 mb-1">
        {entry.strongs && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
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
        {entry.lexeme && (
          <span className="font-semibold text-gray-900 text-base">
            {entry.lexeme}
          </span>
        )}
        {entry.transliteration && (
          <span className="text-xs text-gray-500 italic">{entry.transliteration}</span>
        )}
      </div>

      {entry.shortDefinition && (
        <p className="text-xs text-gray-700">
          <strong>{entry.shortDefinition}</strong>
        </p>
      )}
    </div>
  );
}
