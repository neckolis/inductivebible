import type { WordMarkings } from "./storage";
import type { SymbolDef } from "../store/symbolStore";
import type { WordAssociation } from "../store/memoryStore";
import type { NoteBlock } from "./noteTypes";

const API_BASE = "/api/data";

// --------------- Device ID ---------------

let deviceId: string | null = null;

function getDeviceId(): string {
  if (deviceId) return deviceId;
  deviceId = localStorage.getItem("device-id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device-id", deviceId);
  }
  return deviceId;
}

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Device-Id": getDeviceId(),
  };
}

/** Fetch options with credentials (sends session cookie) + device-id header */
function fetchOpts(extra?: RequestInit): RequestInit {
  return { credentials: "include", headers: headers(), ...extra };
}

// --------------- Debounce ---------------

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function debounce(key: string, fn: () => void, ms = 800) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      fn();
    }, ms)
  );
}

// --------------- Markings ---------------

interface SyncResponse<T> {
  data: T | null;
  updatedAt: number | null;
}

export async function fetchMarkingsFromCloud(
  translation: string,
  book: number,
  chapter: number
): Promise<SyncResponse<Record<string, WordMarkings>>> {
  try {
    const res = await fetch(
      `${API_BASE}/markings/${translation}/${book}/${chapter}`,
      fetchOpts()
    );
    if (!res.ok) return { data: null, updatedAt: null };
    return await res.json();
  } catch {
    return { data: null, updatedAt: null };
  }
}

export function syncMarkingsToCloud(
  translation: string,
  book: number,
  chapter: number,
  data: Record<string, WordMarkings>
): void {
  const key = `markings:${translation}:${book}:${chapter}`;
  debounce(key, async () => {
    try {
      await fetch(
        `${API_BASE}/markings/${translation}/${book}/${chapter}`,
        fetchOpts({
          method: "PUT",
          body: JSON.stringify({ data }),
        })
      );
    } catch {
      // offline — will sync next time
    }
  });
}

// --------------- Markings backup ---------------

export async function fetchMarkingsBackup(
  translation: string,
  book: number,
  chapter: number
): Promise<{ data: Record<string, WordMarkings> | null }> {
  try {
    const res = await fetch(
      `${API_BASE}/markings-backup/${translation}/${book}/${chapter}`,
      fetchOpts()
    );
    if (!res.ok) return { data: null };
    return await res.json();
  } catch {
    return { data: null };
  }
}

export async function restoreMarkingsFromBackup(
  translation: string,
  book: number,
  chapter: number
): Promise<{ ok: boolean; data: Record<string, WordMarkings> | null }> {
  try {
    const res = await fetch(
      `${API_BASE}/markings-backup/${translation}/${book}/${chapter}`,
      fetchOpts({ method: "POST" })
    );
    if (!res.ok) return { ok: false, data: null };
    const json = await res.json();
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, data: null };
  }
}

// --------------- Preferences ---------------

export interface Preferences {
  defaultTranslation?: string;
}

export async function fetchPreferences(): Promise<{ data: Preferences | null }> {
  try {
    const res = await fetch(`${API_BASE}/preferences`, fetchOpts());
    if (!res.ok) return { data: null };
    return await res.json();
  } catch {
    return { data: null };
  }
}

export function syncPreferencesToCloud(data: Preferences): void {
  debounce("preferences", async () => {
    try {
      await fetch(`${API_BASE}/preferences`, fetchOpts({
        method: "PUT",
        body: JSON.stringify({ data }),
      }));
    } catch {
      // offline
    }
  });
}

// --------------- Delete account ---------------

export async function deleteAccountOnServer(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/delete-account`, fetchOpts({
      method: "POST",
      body: JSON.stringify({ confirm: "DELETE" }),
    }));
    return res.ok;
  } catch {
    return false;
  }
}

// --------------- Symbols ---------------

export async function fetchSymbolsFromCloud(): Promise<SyncResponse<SymbolDef[]>> {
  try {
    const res = await fetch(`${API_BASE}/symbols`, fetchOpts());
    if (!res.ok) return { data: null, updatedAt: null };
    return await res.json();
  } catch {
    return { data: null, updatedAt: null };
  }
}

export function syncSymbolsToCloud(data: SymbolDef[]): void {
  debounce("symbols", async () => {
    try {
      await fetch(`${API_BASE}/symbols`, fetchOpts({
        method: "PUT",
        body: JSON.stringify({ data }),
      }));
    } catch {
      // offline
    }
  });
}

// --------------- Memory ---------------

export async function fetchMemoryFromCloud(): Promise<
  SyncResponse<Record<string, WordAssociation[]>>
> {
  try {
    const res = await fetch(`${API_BASE}/memory`, fetchOpts());
    if (!res.ok) return { data: null, updatedAt: null };
    return await res.json();
  } catch {
    return { data: null, updatedAt: null };
  }
}

export function syncMemoryToCloud(
  data: Record<string, WordAssociation[]>
): void {
  debounce("memory", async () => {
    try {
      await fetch(`${API_BASE}/memory`, fetchOpts({
        method: "PUT",
        body: JSON.stringify({ data }),
      }));
    } catch {
      // offline
    }
  });
}

// --------------- Notes ---------------

export async function fetchNotesFromCloud(
  translation: string,
  book: number,
  chapter: number
): Promise<SyncResponse<NoteBlock[]>> {
  try {
    const res = await fetch(
      `${API_BASE}/notes/${translation}/${book}/${chapter}`,
      fetchOpts()
    );
    if (!res.ok) return { data: null, updatedAt: null };
    return await res.json();
  } catch {
    return { data: null, updatedAt: null };
  }
}

export function syncNotesToCloud(
  translation: string,
  book: number,
  chapter: number,
  data: NoteBlock[]
): void {
  const key = `notes:${translation}:${book}:${chapter}`;
  debounce(key, async () => {
    try {
      await fetch(
        `${API_BASE}/notes/${translation}/${book}/${chapter}`,
        fetchOpts({
          method: "PUT",
          body: JSON.stringify({ data }),
        })
      );
    } catch {
      // offline — will sync next time
    }
  });
}
