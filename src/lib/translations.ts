export const TRANSLATIONS = [
  { id: "NASB", label: "NASB" },
  { id: "ESV", label: "ESV" },
  { id: "KJV", label: "KJV" },
  { id: "NKJV", label: "NKJV" },
  { id: "NIV", label: "NIV" },
  { id: "NLT", label: "NLT" },
  { id: "YLT", label: "YLT" },
  { id: "ASV", label: "ASV" },
] as const;

export type TranslationId = (typeof TRANSLATIONS)[number]["id"];
