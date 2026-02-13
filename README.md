# Inductive Bible

A Bible study app for inductive study with text marking, symbols, notes, and cloud sync.

Live at [inductivebible.ai](https://inductivebible.ai)

## Features

- **Multiple translations** — NASB, ESV, KJV, NKJV, NIV, NLT, and more
- **Text marking** — Highlight, underline (single/double/wavy), and symbol annotations on individual words
- **Drag-to-select** — Click-drag or touch-drag to select word ranges
- **Notion-style notes** — Per-chapter notes with slash commands (headings, bullets, quotes, to-dos, callouts)
- **Symbol glossary** — Custom icon palette with memory tracking
- **Cloud sync** — Markings, symbols, and notes sync to your account
- **Auth** — Email/password and Google OAuth via Better Auth
- **Password reset** — Email-based reset flow via Resend
- **Keyboard shortcuts** — Full keyboard navigation (arrow keys, hotkeys for tools)
- **Works offline** — Local-first with localStorage, syncs when online

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Zustand
- **Backend:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **Cache:** Cloudflare KV
- **Auth:** Better Auth with Drizzle adapter
- **Email:** Resend
- **Bible data:** Bolls.life API

## Development

```bash
npm install
npm run dev
```

Runs Vite dev server at `http://localhost:5173` with API proxy to Bolls.life.

Create a `.dev.vars` file for local secrets:

```
BETTER_AUTH_SECRET=your-secret
BETTER_AUTH_URL=http://localhost:5173
RESEND_API_KEY=your-resend-key
```

## Deploy

```bash
npm run deploy
```

Builds the frontend, applies D1 migrations, and deploys to Cloudflare Workers.

## Secrets

Set production secrets via wrangler:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put RESEND_API_KEY
```
