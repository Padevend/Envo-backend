# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# openssl : requis par le moteur de requêtes Prisma sur Alpine.
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

# ── build : installation, génération du client Prisma, compilation, retrait des dépendances de dev ──
FROM base AS build
COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
COPY prisma ./prisma
RUN pnpm prisma:generate
COPY tsconfig.json tsconfig.build.json app.rc.ts ./
COPY bin ./bin
COPY config ./config
COPY start ./start
COPY app ./app
RUN pnpm build && pnpm prune --prod

# ── runtime : image minimale, utilisateur non root, aucun secret ──
FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.APP_PORT||3000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/bin/server.js"]
