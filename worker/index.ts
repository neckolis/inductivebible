import { createAuth } from "./auth";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
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

    if (url.pathname.startsWith("/api/data/")) {
      return handleDataAPI(request, url, env);
    }

    return env.ASSETS.fetch(request);
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

// --------------- CORS helpers ---------------

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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
