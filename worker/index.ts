import { createAuth } from "./auth";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
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

  // 1. Delete data tables
  const dataTables = ["markings", "symbols", "memory", "notes", "preferences"];
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
