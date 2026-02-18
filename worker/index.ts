import { createAuth } from "./auth";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
  KIMI_API_KEY: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

/** Resolved identity: either an authenticated user or anonymous device */
interface Owner {
  userId: string | null;
  deviceId: string | null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsResponse(new Response(null, { status: 204 }));
    }

    // Auth routes — handled entirely by Better Auth
    if (url.pathname.startsWith("/api/auth")) {
      const auth = createAuth(env);
      return auth.handler(request);
    }

    if (url.pathname.startsWith("/api/bible/")) {
      return handleBibleAPI(url, env);
    }

    if (url.pathname.startsWith("/api/dict/")) {
      return handleDictAPI(url, env);
    }

    if (url.pathname === "/api/word-study" && request.method === "POST") {
      return handleWordStudy(request, env);
    }

    if (url.pathname.startsWith("/api/chat/")) {
      return handleChatAPI(request, url, env);
    }

    if (url.pathname.startsWith("/api/data/")) {
      return handleDataAPI(request, url, env);
    }

    const assetResponse = await env.ASSETS.fetch(request);

    // Set cache headers: hashed assets cache forever, index.html never caches
    const isHashed = url.pathname.startsWith("/assets/");
    const headers = new Headers(assetResponse.headers);
    headers.set(
      "Cache-Control",
      isHashed ? "public, max-age=31536000, immutable" : "no-cache"
    );

    return new Response(assetResponse.body, {
      status: assetResponse.status,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;

// --------------- Owner resolution ---------------

async function resolveOwner(request: Request, env: Env): Promise<Owner> {
  // Try session-based auth first
  try {
    const auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user?.id) {
      return { userId: session.user.id, deviceId: null };
    }
  } catch {
    // No valid session — fall through to device ID
  }

  // Fall back to anonymous device ID
  const deviceId = request.headers.get("X-Device-Id");
  if (deviceId && deviceId.length <= 64) {
    return { userId: null, deviceId };
  }

  return { userId: null, deviceId: null };
}

// --------------- Bible API proxy + KV cache ---------------

async function handleBibleAPI(url: URL, env: Env): Promise<Response> {
  const parts = url.pathname.split("/");
  const translation = parts[3];
  const book = parts[4];
  const chapter = parts[5];

  if (!translation || !book || !chapter) {
    return corsJson({ error: "Invalid path. Use /api/bible/:translation/:book/:chapter" }, 400);
  }

  const cacheKey = `bible:${translation}:${book}:${chapter}`;

  // Try KV cache first
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return corsJson(JSON.parse(cached), 200, {
      "Cache-Control": "public, max-age=3600",
      "X-Cache": "HIT",
    });
  }

  const apiUrl = `https://bolls.life/get-chapter/${translation}/${book}/${chapter}/`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "PreceptBibleApp/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return corsJson({ error: `Bible API returned ${response.status}` }, response.status);
    }

    const data = await response.json();

    // Cache in KV for 24 hours
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 });

    return corsJson(data, 200, {
      "Cache-Control": "public, max-age=3600",
      "X-Cache": "MISS",
    });
  } catch {
    return corsJson({ error: "Failed to fetch from Bible API" }, 502);
  }
}

// --------------- Data API (markings, symbols, memory, notes) ---------------

async function handleDataAPI(request: Request, url: URL, env: Env): Promise<Response> {
  const owner = await resolveOwner(request, env);

  if (!owner.userId && !owner.deviceId) {
    return corsJson({ error: "Not authenticated. Sign in or provide X-Device-Id header." }, 401);
  }

  // Ensure device row exists for anonymous users
  if (owner.deviceId) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO devices (id, created_at) VALUES (?, ?)"
    ).bind(owner.deviceId, Date.now()).run();
  }

  const path = url.pathname.replace("/api/data/", "");

  // Device claiming: migrate anonymous data to user account
  if (path === "claim-device" && request.method === "POST") {
    return handleClaimDevice(request, owner, env);
  }

  // User info endpoint
  if (path === "me") {
    return handleMe(owner, env);
  }

  if (path === "delete-account" && request.method === "POST") {
    return handleDeleteAccount(request, owner, env);
  }

  if (path === "preferences") {
    return handlePreferences(request, owner, env);
  }

  if (path.startsWith("markings-backup/")) {
    return handleMarkingsBackup(request, path, owner, env);
  }

  if (path.startsWith("markings/")) {
    return handleMarkings(request, path, owner, env);
  }
  if (path === "symbols") {
    return handleSymbols(request, owner, env);
  }
  if (path === "memory") {
    return handleMemory(request, owner, env);
  }
  if (path.startsWith("notes/")) {
    return handleNotes(request, path, owner, env);
  }

  return corsJson({ error: "Not found" }, 404);
}

// --------------- User info ---------------

async function handleMe(owner: Owner, env: Env): Promise<Response> {
  if (!owner.userId) {
    return corsJson({ user: null, deviceId: owner.deviceId });
  }

  const row = await env.DB.prepare(
    'SELECT id, name, email, image FROM "user" WHERE id = ?'
  ).bind(owner.userId).first();

  return corsJson({ user: row ?? null });
}

// --------------- Device claiming ---------------

async function handleClaimDevice(request: Request, owner: Owner, env: Env): Promise<Response> {
  if (!owner.userId) {
    return corsJson({ error: "Must be authenticated to claim device data" }, 401);
  }

  const body = await request.json() as { deviceId: string };
  const deviceId = body.deviceId;
  if (!deviceId) {
    return corsJson({ error: "Missing deviceId" }, 400);
  }

  // Migrate all data from device_id to user_id
  const tables = ["markings", "symbols", "memory", "notes"];
  for (const table of tables) {
    await env.DB.prepare(
      `UPDATE ${table} SET user_id = ? WHERE device_id = ? AND user_id IS NULL`
    ).bind(owner.userId, deviceId).run();
  }

  return corsJson({ ok: true, claimed: deviceId });
}

// --------------- Query helpers ---------------

/** Build WHERE clause and params for owner-based queries */
function ownerWhere(owner: Owner): { clause: string; param: string } {
  if (owner.userId) {
    return { clause: "user_id = ?", param: owner.userId };
  }
  return { clause: "device_id = ?", param: owner.deviceId! };
}

function ownerInsertFields(owner: Owner): { columns: string; values: string; params: string[] } {
  if (owner.userId) {
    return {
      columns: "device_id, user_id",
      values: "?, ?",
      params: ["__user__", owner.userId],
    };
  }
  return {
    columns: "device_id",
    values: "?",
    params: [owner.deviceId!],
  };
}

// --------------- Markings ---------------

async function handleMarkings(
  request: Request,
  path: string,
  owner: Owner,
  env: Env
): Promise<Response> {
  const parts = path.replace("markings/", "").split("/");
  const [translation, bookStr, chapterStr] = parts;

  if (!translation || !bookStr || !chapterStr) {
    return corsJson({ error: "Invalid path" }, 400);
  }

  const book = Number(bookStr);
  const chapter = Number(chapterStr);
  const { clause, param } = ownerWhere(owner);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT data, updated_at FROM markings WHERE ${clause} AND translation = ? AND book = ? AND chapter = ?`
    ).bind(param, translation, book, chapter).first();

    return corsJson({
      data: row ? JSON.parse(row.data as string) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { data: unknown };
    const now = Date.now();
    const ins = ownerInsertFields(owner);

    // Backup current markings to KV before overwriting with empty data
    const isClearing = !body.data || (typeof body.data === "object" && Object.keys(body.data as object).length === 0);
    if (isClearing) {
      const existing = await env.DB.prepare(
        `SELECT data FROM markings WHERE ${clause} AND translation = ? AND book = ? AND chapter = ?`
      ).bind(param, translation, book, chapter).first();
      if (existing?.data) {
        const parsed = JSON.parse(existing.data as string);
        if (Object.keys(parsed).length > 0) {
          const ownerId = owner.userId ?? owner.deviceId!;
          const backupKey = `backup:markings:${ownerId}:${translation}:${book}:${chapter}`;
          await env.CACHE.put(backupKey, existing.data as string, { expirationTtl: 7 * 86400 });
        }
      }
    }

    await env.DB.prepare(
      `INSERT INTO markings (${ins.columns}, translation, book, chapter, data, updated_at)
       VALUES (${ins.values}, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id, translation, book, chapter)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, user_id = COALESCE(excluded.user_id, user_id)`
    ).bind(...ins.params, translation, book, chapter, JSON.stringify(body.data), now).run();

    return corsJson({ ok: true, updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

// --------------- Symbols ---------------

async function handleSymbols(
  request: Request,
  owner: Owner,
  env: Env
): Promise<Response> {
  const { clause, param } = ownerWhere(owner);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT data, updated_at FROM symbols WHERE ${clause}`
    ).bind(param).first();

    return corsJson({
      data: row ? JSON.parse(row.data as string) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { data: unknown };
    const now = Date.now();
    const ins = ownerInsertFields(owner);

    await env.DB.prepare(
      `INSERT INTO symbols (${ins.columns}, data, updated_at)
       VALUES (${ins.values}, ?, ?)
       ON CONFLICT(device_id)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, user_id = COALESCE(excluded.user_id, user_id)`
    ).bind(...ins.params, JSON.stringify(body.data), now).run();

    return corsJson({ ok: true, updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

// --------------- Memory ---------------

async function handleMemory(
  request: Request,
  owner: Owner,
  env: Env
): Promise<Response> {
  const { clause, param } = ownerWhere(owner);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT data, updated_at FROM memory WHERE ${clause}`
    ).bind(param).first();

    return corsJson({
      data: row ? JSON.parse(row.data as string) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { data: unknown };
    const now = Date.now();
    const ins = ownerInsertFields(owner);

    await env.DB.prepare(
      `INSERT INTO memory (${ins.columns}, data, updated_at)
       VALUES (${ins.values}, ?, ?)
       ON CONFLICT(device_id)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, user_id = COALESCE(excluded.user_id, user_id)`
    ).bind(...ins.params, JSON.stringify(body.data), now).run();

    return corsJson({ ok: true, updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

// --------------- Notes ---------------

async function handleNotes(
  request: Request,
  path: string,
  owner: Owner,
  env: Env
): Promise<Response> {
  const parts = path.replace("notes/", "").split("/");
  const [translation, bookStr, chapterStr] = parts;

  if (!translation || !bookStr || !chapterStr) {
    return corsJson({ error: "Invalid path" }, 400);
  }

  const book = Number(bookStr);
  const chapter = Number(chapterStr);
  const { clause, param } = ownerWhere(owner);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT data, updated_at FROM notes WHERE ${clause} AND translation = ? AND book = ? AND chapter = ?`
    ).bind(param, translation, book, chapter).first();

    return corsJson({
      data: row ? JSON.parse(row.data as string) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { data: unknown };
    const now = Date.now();
    const ins = ownerInsertFields(owner);

    await env.DB.prepare(
      `INSERT INTO notes (${ins.columns}, translation, book, chapter, data, updated_at)
       VALUES (${ins.values}, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id, translation, book, chapter)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, user_id = COALESCE(excluded.user_id, user_id)`
    ).bind(...ins.params, translation, book, chapter, JSON.stringify(body.data), now).run();

    return corsJson({ ok: true, updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

// --------------- Delete account ---------------

async function handleDeleteAccount(
  request: Request,
  owner: Owner,
  env: Env
): Promise<Response> {
  if (!owner.userId) {
    return corsJson({ error: "Must be authenticated to delete account" }, 401);
  }

  const body = await request.json() as { confirm?: string };
  if (body.confirm !== "DELETE") {
    return corsJson({ error: 'Must send { "confirm": "DELETE" } to confirm' }, 400);
  }

  const userId = owner.userId;

  // Look up email for verification table cleanup
  const userRow = await env.DB.prepare(
    'SELECT email FROM "user" WHERE id = ?'
  ).bind(userId).first();
  const email = userRow?.email as string | undefined;

  // 1. Delete data tables (conversations cascade-deletes messages)
  const dataTables = ["markings", "symbols", "memory", "notes", "preferences", "chat_rate_limits", "conversations"];
  for (const table of dataTables) {
    await env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId).run();
  }

  // 2. Delete auth tables
  await env.DB.prepare('DELETE FROM "session" WHERE "userId" = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM "account" WHERE "userId" = ?').bind(userId).run();
  if (email) {
    await env.DB.prepare('DELETE FROM "verification" WHERE "identifier" = ?').bind(email).run();
  }
  await env.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(userId).run();

  return corsJson({ ok: true });
}

// --------------- Markings backup ---------------

async function handleMarkingsBackup(
  request: Request,
  path: string,
  owner: Owner,
  env: Env
): Promise<Response> {
  const parts = path.replace("markings-backup/", "").split("/");
  const [translation, bookStr, chapterStr] = parts;

  if (!translation || !bookStr || !chapterStr) {
    return corsJson({ error: "Invalid path" }, 400);
  }

  const book = Number(bookStr);
  const chapter = Number(chapterStr);
  const ownerId = owner.userId ?? owner.deviceId!;
  const backupKey = `backup:markings:${ownerId}:${translation}:${book}:${chapter}`;

  if (request.method === "GET") {
    const backup = await env.CACHE.get(backupKey);
    if (!backup) {
      return corsJson({ data: null });
    }
    return corsJson({ data: JSON.parse(backup) });
  }

  if (request.method === "POST") {
    // Restore: read backup from KV and write into D1
    const backup = await env.CACHE.get(backupKey);
    if (!backup) {
      return corsJson({ error: "No backup found" }, 404);
    }

    const now = Date.now();
    const { clause, param } = ownerWhere(owner);
    const ins = ownerInsertFields(owner);

    await env.DB.prepare(
      `INSERT INTO markings (${ins.columns}, translation, book, chapter, data, updated_at)
       VALUES (${ins.values}, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id, translation, book, chapter)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, user_id = COALESCE(excluded.user_id, user_id)`
    ).bind(...ins.params, translation, book, chapter, backup, now).run();

    // Delete the backup after restoring
    await env.CACHE.delete(backupKey);

    return corsJson({ ok: true, data: JSON.parse(backup), updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

// --------------- Preferences ---------------

async function handlePreferences(
  request: Request,
  owner: Owner,
  env: Env
): Promise<Response> {
  if (!owner.userId) {
    return corsJson({ error: "Must be authenticated to use preferences" }, 401);
  }

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT data, updated_at FROM preferences WHERE user_id = ?"
    ).bind(owner.userId).first();

    return corsJson({
      data: row ? JSON.parse(row.data as string) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { data: unknown };
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO preferences (user_id, data, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).bind(owner.userId, JSON.stringify(body.data), now).run();

    return corsJson({ ok: true, updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

// --------------- Dictionary API proxy ---------------

async function handleDictAPI(url: URL, env: Env): Promise<Response> {
  const query = url.pathname.replace("/api/dict/", "").replace(/\/$/, "").trim();
  if (!query) {
    return corsJson({ error: "Missing query" }, 400);
  }

  const cacheKey = `dict:${query.toLowerCase()}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return corsJson(JSON.parse(cached), 200, { "X-Cache": "HIT" });
  }

  try {
    const res = await fetch(
      `https://bolls.life/dictionary-definition/BDBT/${encodeURIComponent(query)}/`,
      { headers: { "User-Agent": "PreceptBibleApp/1.0", Accept: "application/json" } }
    );
    if (!res.ok) {
      return corsJson({ error: `Dictionary API returned ${res.status}` }, res.status);
    }
    const data = await res.json();
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 604800 }); // 7 days
    return corsJson(data, 200, { "X-Cache": "MISS" });
  } catch {
    return corsJson({ error: "Failed to fetch dictionary" }, 502);
  }
}

// --------------- Word Study endpoint ---------------

interface WordStudyEntry {
  word: string;
  strongs: string;
  lexeme: string;
  transliteration: string;
  pronunciation: string;
  shortDefinition: string;
  definition: string;
}

/** Parse KJV text with Strong's tags: word<S>number</S> */
function parseKjvStrongs(
  text: string,
  isOT: boolean
): { word: string; strongs: string }[] {
  const results: { word: string; strongs: string }[] = [];
  // Match patterns like: word<S>1234</S> or word<S>H1234</S>
  const regex = /(\S+?)<S>([^<]+)<\/S>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const word = match[1].replace(/[^a-zA-Z']/g, "").toLowerCase();
    let num = match[2].trim();
    // Normalize: if bare number, prefix G (NT) or H (OT)
    if (/^\d+$/.test(num)) {
      num = (isOT ? "H" : "G") + num;
    }
    if (word) {
      results.push({ word, strongs: num.toUpperCase() });
    }
  }
  return results;
}

async function fetchDictEntry(
  query: string,
  env: Env
): Promise<Record<string, unknown>[] | null> {
  const cacheKey = `dict:${query.toLowerCase()}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const res = await fetch(
      `https://bolls.life/dictionary-definition/BDBT/${encodeURIComponent(query)}/`,
      { headers: { "User-Agent": "PreceptBibleApp/1.0", Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>[];
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 604800 });
    return data;
  } catch {
    return null;
  }
}

function extractEntry(
  raw: Record<string, unknown>,
  word: string,
  strongs: string
): WordStudyEntry {
  const topic = String(raw.topic ?? "");

  // definition field contains HTML — strip tags for plain text
  const defHtml = String(raw.definition ?? "");
  const defText = defHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // Short definition from API, or first sentence of full definition
  const apiShortDef = String(raw.short_definition ?? "").trim();
  let shortDef = apiShortDef;
  if (!shortDef) {
    const firstSentence = defText.match(/^[^.!?]+[.!?]/);
    shortDef = firstSentence ? firstSentence[0].trim() : defText.slice(0, 120).trim();
  }

  return {
    word,
    strongs: strongs || topic.split(" ")[0] || "",
    lexeme: String(raw.lexeme ?? ""),
    transliteration: String(raw.transliteration ?? ""),
    pronunciation: String(raw.pronunciation ?? ""),
    shortDefinition: shortDef,
    definition: defText,
  };
}

async function handleWordStudy(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    words: string[];
    book: number;
    chapter: number;
    startVerse: number;
    endVerse: number;
  };

  const { words, book, chapter, startVerse, endVerse } = body;
  if (!words?.length || !book || !chapter) {
    return corsJson({ error: "Missing required fields" }, 400);
  }

  const isOT = book <= 39;

  // Fetch KJV verses for Strong's cross-reference
  const kjvCacheKey = `bible:KJV:${book}:${chapter}`;
  let kjvVerses: { verse: number; text: string }[] = [];

  const cachedKjv = await env.CACHE.get(kjvCacheKey);
  if (cachedKjv) {
    kjvVerses = JSON.parse(cachedKjv);
  } else {
    try {
      const res = await fetch(
        `https://bolls.life/get-chapter/KJV/${book}/${chapter}/`,
        { headers: { "User-Agent": "PreceptBibleApp/1.0", Accept: "application/json" } }
      );
      if (res.ok) {
        kjvVerses = (await res.json()) as { verse: number; text: string }[];
        await env.CACHE.put(kjvCacheKey, JSON.stringify(kjvVerses), { expirationTtl: 86400 });
      }
    } catch {
      // Continue without KJV
    }
  }

  // Build word→Strong's mapping from KJV
  const wordToStrongs = new Map<string, string>();
  for (const v of kjvVerses) {
    if (v.verse >= startVerse && v.verse <= endVerse) {
      for (const { word: w, strongs } of parseKjvStrongs(v.text, isOT)) {
        if (!wordToStrongs.has(w)) {
          wordToStrongs.set(w, strongs);
        }
      }
    }
  }

  // Look up each selected word
  const entries: WordStudyEntry[] = [];
  const lookups = words.map(async (word) => {
    const clean = word.replace(/[^a-zA-Z']/g, "").toLowerCase();
    if (!clean || clean.length < 2) return null;

    // Look up via Strong's number from KJV (English word search is unreliable)
    const strongs = wordToStrongs.get(clean);
    if (!strongs) return null;

    const data = await fetchDictEntry(strongs, env);
    if (data?.length) {
      return extractEntry(data[0], word, strongs);
    }
    return null;
  });

  const results = await Promise.all(lookups);
  for (const r of results) {
    if (r) entries.push(r);
  }

  return corsJson({ entries });
}

// --------------- Chat API ---------------

const CHAT_SYSTEM_PROMPT = `You are a Precept Inductive Bible Study mentor in the tradition of Kay Arthur and Bruce Hurt (Precept Austin). Scripture is your final authority — inerrant, sufficient, and living. You hold truth with conviction, never hedging or apologizing for what the Bible plainly teaches. Jesus Christ is Lord.

WHEN THE USER ASKS A DIRECT QUESTION (e.g. "What is truth?", "Who is the Holy Spirit?", "What does the Bible say about forgiveness?"):
- Give a direct biblical answer. State the answer, cite the key Scriptures, and stop.
- Do NOT walk through Observation → Interpretation → Application. Just answer.
- Keep it concise — a few paragraphs at most.

WHEN THE USER IS STUDYING A SPECIFIC PASSAGE (e.g. "Help me study John 3:16", "What does this verse mean?", or when passage context is provided):
- Focus heavily on OBSERVATION: What does the text say? Define key words using original languages (Hebrew/Greek from lexical data when provided). Identify who, what, when, where, why, how. Note repeated words, contrasts, comparisons, terms of conclusion.
- Provide immediate context, historical/cultural background, and relevant cross-references from Scripture.
- Do NOT provide interpretation or application unless the user explicitly asks for it. Just show them what the text says and let Scripture speak.

HERMENEUTIC: Grammatical-historical. Plain, literal sense accounting for genre, grammar, historical setting, and authorial intent.

THEOLOGICAL CONVICTIONS (hold firmly):
- The Bible is the inspired, inerrant Word of God — the supreme authority
- Trinity, full deity and humanity of Christ, virgin birth, bodily resurrection
- Salvation by grace alone through faith alone in Christ alone
- The gospel: man is sinful, God is holy, Christ died as substitute, repent and believe
- Reformed soteriology (the doctrines of grace)
- Premillennial, pretribulational eschatology; distinction between Israel and the Church

On secondary matters (baptism mode, spiritual gifts, church governance, creation timeline) — state your reading of the text but acknowledge faithful believers differ.

TONE AND STYLE:
- Be direct. No filler ("Great question!", "That's wonderful!", "I'd love to help!"). Just teach.
- Be concise — say what needs saying, then stop. Short paragraphs.
- When the user asks a direct theological question, give a direct biblical answer with references. Don't hedge on what Scripture is clear about.
- When word study data is provided in the context, reference it accurately — do not invent etymologies.
- Cite Scripture references for every claim. The Bible makes the case, not you.
- If a question is outside the Bible's scope, say so plainly and redirect to what Scripture does address.`;

async function handleChatAPI(request: Request, url: URL, env: Env): Promise<Response> {
  const owner = await resolveOwner(request, env);
  if (!owner.userId) {
    return corsJson({ error: "Sign in to use the AI chat feature." }, 401);
  }

  const path = url.pathname.replace("/api/chat/", "");

  // POST /api/chat/conversations — create
  if (path === "conversations" && request.method === "POST") {
    const id = crypto.randomUUID();
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, owner.userId, "", now, now).run();
    return corsJson({ id, title: "", createdAt: now });
  }

  // GET /api/chat/conversations — list
  if (path === "conversations" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50"
    ).bind(owner.userId).all();
    return corsJson({ conversations: rows.results });
  }

  // DELETE /api/chat/conversations/:id
  const deleteMatch = path.match(/^conversations\/([^/]+)$/);
  if (deleteMatch && request.method === "DELETE") {
    const convId = deleteMatch[1];
    // Verify ownership
    const conv = await env.DB.prepare(
      "SELECT id FROM conversations WHERE id = ? AND user_id = ?"
    ).bind(convId, owner.userId).first();
    if (!conv) return corsJson({ error: "Not found" }, 404);
    await env.DB.prepare("DELETE FROM conversations WHERE id = ?").bind(convId).run();
    return corsJson({ ok: true });
  }

  // GET /api/chat/conversations/:id/messages
  const msgMatch = path.match(/^conversations\/([^/]+)\/messages$/);
  if (msgMatch && request.method === "GET") {
    const convId = msgMatch[1];
    // Verify ownership
    const conv = await env.DB.prepare(
      "SELECT id FROM conversations WHERE id = ? AND user_id = ?"
    ).bind(convId, owner.userId).first();
    if (!conv) return corsJson({ error: "Not found" }, 404);
    const rows = await env.DB.prepare(
      "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    ).bind(convId).all();
    return corsJson({ messages: rows.results });
  }

  // POST /api/chat/messages — send + stream response
  if (path === "messages" && request.method === "POST") {
    return handleChatMessage(request, owner.userId, env);
  }

  return corsJson({ error: "Not found" }, 404);
}

async function handleChatMessage(request: Request, userId: string, env: Env): Promise<Response> {
  const body = await request.json() as {
    conversationId: string;
    content: string;
    contextPrompt?: string;
    wordStudy?: WordStudyEntry[];
  };

  const { conversationId, content, contextPrompt, wordStudy } = body;
  if (!conversationId || !content) {
    return corsJson({ error: "Missing conversationId or content" }, 400);
  }

  // Verify conversation ownership
  const conv = await env.DB.prepare(
    "SELECT id, title FROM conversations WHERE id = ? AND user_id = ?"
  ).bind(conversationId, userId).first();
  if (!conv) return corsJson({ error: "Conversation not found" }, 404);

  // Rate limit: 30 msgs per hour
  const hourWindow = Math.floor(Date.now() / 3600000);
  const rateRow = await env.DB.prepare(
    "SELECT message_count FROM chat_rate_limits WHERE user_id = ? AND window_start = ?"
  ).bind(userId, hourWindow).first();

  const currentCount = (rateRow?.message_count as number) ?? 0;
  if (currentCount >= 30) {
    return corsJson({
      error: "You've reached the limit of 30 messages per hour. Please try again shortly."
    }, 429);
  }

  // Increment rate limit
  await env.DB.prepare(
    `INSERT INTO chat_rate_limits (user_id, window_start, message_count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, window_start) DO UPDATE SET message_count = message_count + 1`
  ).bind(userId, hourWindow).run();

  // Build lexical context from word study data
  let lexicalContext = "";
  if (wordStudy?.length) {
    const lines = wordStudy.map((e) => {
      const parts = [`${e.word}`];
      if (e.strongs) parts.push(`[${e.strongs}]`);
      if (e.lexeme) parts.push(`— ${e.lexeme}`);
      if (e.transliteration) parts.push(`(${e.transliteration})`);
      if (e.shortDefinition) parts.push(`"${e.shortDefinition}"`);
      return parts.join(" ");
    });
    lexicalContext = `\n\n[Dictionary data for key words — reference this for accuracy]\n${lines.join("\n")}`;
  }

  // Save user message
  const userMsgContent = contextPrompt ? `${contextPrompt}\n\n${content}` : content;
  const userMsgId = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(userMsgId, conversationId, "user", userMsgContent, now).run();

  // Auto-title on first message
  if (!conv.title) {
    const title = content.length > 60 ? content.slice(0, 57) + "..." : content;
    await env.DB.prepare(
      "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?"
    ).bind(title, now, conversationId).run();
  } else {
    await env.DB.prepare(
      "UPDATE conversations SET updated_at = ? WHERE id = ?"
    ).bind(now, conversationId).run();
  }

  // Load last 20 messages for context
  const historyRows = await env.DB.prepare(
    "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20"
  ).bind(conversationId).all();

  const history = historyRows.results.reverse().map((r) => ({
    role: r.role as string,
    content: r.content as string,
  }));

  // Build messages array for Kimi
  const systemContent = lexicalContext
    ? CHAT_SYSTEM_PROMPT + lexicalContext
    : CHAT_SYSTEM_PROMPT;
  const kimiMessages = [
    { role: "system", content: systemContent },
    ...history,
  ];

  // Call Kimi API with streaming
  const kimiResponse = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-8k",
      messages: kimiMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!kimiResponse.ok || !kimiResponse.body) {
    let detail = "";
    try { detail = await kimiResponse.text(); } catch {}
    console.error("Kimi API error:", kimiResponse.status, detail);
    if (kimiResponse.status === 401) {
      return corsJson({ error: "AI service configuration error. Please contact support." }, 502);
    }
    return corsJson({ error: "AI service unavailable. Please try again." }, 502);
  }

  // Set up streaming transform
  let fullContent = "";
  const assistantMsgId = crypto.randomUUID();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Process the stream in the background
  (async () => {
    try {
      const reader = kimiResponse.body!.getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            await writer.write(encoder.encode("data: [DONE]\n\n"));
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              await writer.write(
                encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`)
              );
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch {
      // stream interrupted
    } finally {
      // Save assistant message
      if (fullContent) {
        try {
          await env.DB.prepare(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(assistantMsgId, conversationId, "assistant", fullContent, Date.now()).run();
        } catch {
          // DB write failed — message lost but stream was delivered
        }
      }
      try {
        await writer.close();
      } catch {
        // writer already closed
      }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders(),
    },
  });
}

// --------------- CORS helpers ---------------

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Device-Id",
    "Access-Control-Allow-Credentials": "true",
  };
}

function corsResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function corsJson(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}
