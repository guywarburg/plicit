# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/listener/package.json apps/listener/
COPY apps/analyzer/package.json apps/analyzer/
COPY apps/summarizer/package.json apps/summarizer/
COPY apps/actions/package.json apps/actions/
COPY apps/shell/package.json apps/shell/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/llm/package.json packages/llm/
COPY packages/wa/package.json packages/wa/
COPY packages/types/package.json packages/types/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

FROM base AS runtime
COPY --from=deps /app /app
COPY . /app
ENV NODE_ENV=production
RUN pnpm typecheck
# Apps are run as `tsx` directly via `pnpm <app>`. No build step required for now.

# Default command runs the listener; override with `command:` per service in compose.
CMD ["pnpm", "run", "listener"]
