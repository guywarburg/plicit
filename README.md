# Plicit

Personal WhatsApp listener that captures conversations, classifies them with Claude when they go quiet, and turns them into calendar events, knowledge notes, and tasks for a personal-assistant bot.

## Layout

- `apps/listener` — always-on Baileys daemon, owns the WhatsApp socket.
- `apps/analyzer` — hourly cron, classifies stale conversations with Claude tool use.
- `apps/summarizer` — nightly cron, writes a daily Obsidian note.
- `apps/actions` — interactive `review` CLI + executors (calendar, obsidian, PA-bot).
- `apps/shell` — small CLI for `login`, `status`.
- `packages/db` — Drizzle schema + client (SQLite local, Postgres remote).
- `packages/llm` — Anthropic SDK wrapper with prompt caching.
- `packages/wa` — Baileys factory + IPC types.
- `packages/config` — zod-validated env loader.
- `packages/types` — shared domain types.

## Quick start

```sh
corepack enable
pnpm install
cp .env.example .env       # fill in keys
pnpm run migrate           # create sqlite db
pnpm run shell login       # pair WhatsApp
pnpm run listener          # in one shell, runs forever
pnpm run analyzer          # in another, run hourly via cron
```

## Deployment

- macOS local always-on: `deploy/launchd/*.plist`.
- Remote VPS: `deploy/docker/compose.yml`.

See `/Users/guywarburg/.claude/plans/i-would-like-to-swirling-steele.md` for the full design.
