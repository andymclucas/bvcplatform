FROM node:22-alpine AS builder

RUN npm install -g pnpm@10.4.1

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN npm install -g pnpm@10.4.1

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
