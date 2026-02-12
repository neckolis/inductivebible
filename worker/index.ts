interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsResponse(new Response(null, { status: 204 }));
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

// --------------- Data API (markings, symbols, memory) ---------------

async function handleDataAPI(request: Request, url: URL, env: Env): Promise<Response> {
  const deviceId = request.headers.get("X-Device-Id");
  if (!deviceId || deviceId.length > 64) {
    return corsJson({ error: "Missing or invalid X-Device-Id header" }, 401);
  }

  // Ensure device exists
  await env.DB.prepare(
    "INSERT OR IGNORE INTO devices (id, created_at) VALUES (?, ?)"
  ).bind(deviceId, Date.now()).run();

  const path = url.pathname.replace("/api/data/", "");

  if (path.startsWith("markings/")) {
    return handleMarkings(request, path, deviceId, env);
  }
  if (path === "symbols") {
    return handleSymbols(request, deviceId, env);
  }
  if (path === "memory") {
    return handleMemory(request, deviceId, env);
  }
  if (path.startsWith("notes/")) {
    return handleNotes(request, path, deviceId, env);
  }

  return corsJson({ error: "Not found" }, 404);
}

async function handleMarkings(
  request: Request,
  path: string,
  deviceId: string,
  env: Env
): Promise<Response> {
  const parts = path.replace("markings/", "").split("/");
  const [translation, bookStr, chapterStr] = parts;

  if (!translation || !bookStr || !chapterStr) {
    return corsJson({ error: "Invalid path" }, 400);
  }

  const book = Number(bookStr);
  const chapter = Number(chapterStr);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT data, updated_at FROM markings WHERE device_id = ? AND translation = ? AND book = ? AND chapter = ?"
    ).bind(deviceId, translation, book, chapter).first();

    return corsJson({
      data: row ? JSON.parse(row.data as string) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { data: unknown };
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO markings (device_id, translation, book, chapter, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id, translation, book, chapter)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).bind(deviceId, translation, book, chapter, JSON.stringify(body.data), now).run();

    return corsJson({ ok: true, updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

async function handleSymbols(
  request: Request,
  deviceId: string,
  env: Env
): Promise<Response> {
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT data, updated_at FROM symbols WHERE device_id = ?"
    ).bind(deviceId).first();

    return corsJson({
      data: row ? JSON.parse(row.data as string) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { data: unknown };
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO symbols (device_id, data, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).bind(deviceId, JSON.stringify(body.data), now).run();

    return corsJson({ ok: true, updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

async function handleMemory(
  request: Request,
  deviceId: string,
  env: Env
): Promise<Response> {
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT data, updated_at FROM memory WHERE device_id = ?"
    ).bind(deviceId).first();

    return corsJson({
      data: row ? JSON.parse(row.data as string) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { data: unknown };
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO memory (device_id, data, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).bind(deviceId, JSON.stringify(body.data), now).run();

    return corsJson({ ok: true, updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

async function handleNotes(
  request: Request,
  path: string,
  deviceId: string,
  env: Env
): Promise<Response> {
  const parts = path.replace("notes/", "").split("/");
  const [translation, bookStr, chapterStr] = parts;

  if (!translation || !bookStr || !chapterStr) {
    return corsJson({ error: "Invalid path" }, 400);
  }

  const book = Number(bookStr);
  const chapter = Number(chapterStr);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT data, updated_at FROM notes WHERE device_id = ? AND translation = ? AND book = ? AND chapter = ?"
    ).bind(deviceId, translation, book, chapter).first();

    return corsJson({
      data: row ? JSON.parse(row.data as string) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { data: unknown };
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO notes (device_id, translation, book, chapter, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id, translation, book, chapter)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).bind(deviceId, translation, book, chapter, JSON.stringify(body.data), now).run();

    return corsJson({ ok: true, updatedAt: now });
  }

  return corsJson({ error: "Method not allowed" }, 405);
}

// --------------- CORS helpers ---------------

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Device-Id",
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
