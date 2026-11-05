# Envo-backend

Backend de la néobanque Envo (services MeSomb, XAF) : monolithe modulaire **Hono**, MVC, structure inspirée d'AdonisJS.

> **Phase 0 (scaffold)** : structure, configuration validée, `createApp`, conteneur, logger, error handler, health checks, Docker, CI, règles de frontières. Aucune logique financière pour l'instant.

## Démarrage

```bash
corepack enable
pnpm install                  # génère pnpm-lock.yaml : à commiter
cp .env.example .env          # puis renseigner les valeurs
docker compose --env-file .env -f docker/compose.yml -f docker/compose.dev.yml up -d postgres redis
pnpm prisma:generate
pnpm dev                      # http://localhost:3000/health/live
```

## Scripts

| Commande | Rôle |
|---|---|
| `pnpm lint` / `pnpm typecheck` | qualité du code |
| `pnpm arch` | frontières de modules (dependency-cruiser) |
| `pnpm test` | tests (dont `tests/architecture.test.ts`) |
| `pnpm build` / `pnpm start` | compilation / lancement de `dist/` |
| `pnpm format` | Prettier |

## Documentation

- [`docs/architecture.md`](docs/architecture.md) : modules, flux, règles de frontières
- [`docs/open-questions.md`](docs/open-questions.md) : décisions à confirmer, points MeSomb non vérifiés
- [`docs/adr/`](docs/adr) : décisions d'architecture
