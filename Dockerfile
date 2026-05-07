FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun run db:generate 2>/dev/null || true
EXPOSE 3000
CMD ["sh", "-c", "bun run db:migrate && bun run index.ts"]
