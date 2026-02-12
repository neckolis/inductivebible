const MARKINGS_PREFIX = "markings:";

export interface MarkingLayer {
  value: string;
  createdAt: number;
}

export interface WordMarkings {
  highlight?: MarkingLayer;
  underline?: MarkingLayer;
  symbol?: MarkingLayer;
}

/** Check if a WordMarkings object has any layers */
export function hasAnyMarking(m: WordMarkings | undefined): boolean {
  return !!m && !!(m.highlight || m.underline || m.symbol);
}

// Old format for migration
interface LegacyStoredMarking {
  id: string;
  type: "symbol" | "highlight" | "underline";
  value: string;
  createdAt: number;
}

function migrateLegacy(raw: Record<string, any>): Record<string, WordMarkings> {
  const result: Record<string, WordMarkings> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (entry && typeof entry === "object" && "type" in entry) {
      // Old format: { id, type, value, createdAt }
      const legacy = entry as LegacyStoredMarking;
      result[key] = {
        [legacy.type]: { value: legacy.value, createdAt: legacy.createdAt },
      };
    } else {
      // Already new format
      result[key] = entry as WordMarkings;
    }
  }
  return result;
}

export function loadMarkings(
  translation: string,
  book: number,
  chapter: number
): Record<string, WordMarkings> {
  const key = `${MARKINGS_PREFIX}${translation}:${book}:${chapter}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return migrateLegacy(parsed);
  } catch {
    return {};
  }
}

// --- Phosphor symbol value format: "iconName|color|weight" ---

export interface ParsedSymbol {
  icon: string;   // e.g. "Cross"
  color: string;  // e.g. "#dc2626"
  weight: string; // e.g. "fill"
}

export function parseSymbolValue(value: string): ParsedSymbol | null {
  if (!value.includes("|")) return null; // legacy emoji
  const [icon, color, weight] = value.split("|");
  if (!icon || !color || !weight) return null;
  return { icon, color, weight };
}

export function formatSymbolValue(icon: string, color: string, weight: string): string {
  return `${icon}|${color}|${weight}`;
}

export function saveMarkings(
  translation: string,
  book: number,
  chapter: number,
  markings: Record<string, WordMarkings>
): void {
  const key = `${MARKINGS_PREFIX}${translation}:${book}:${chapter}`;
  try {
    localStorage.setItem(key, JSON.stringify(markings));
  } catch {
    // localStorage full or unavailable
  }
}
