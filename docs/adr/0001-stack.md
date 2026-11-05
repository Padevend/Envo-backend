# ADR 0001 — Stack et dépendances de la Phase 0

- **Statut** : proposée (versions non vérifiées, voir `docs/open-questions.md`)
- **Date** : 2026-11-05

## Contexte

Le projet impose de justifier par écrit chaque dépendance. Cet ADR couvre celles de la Phase 0 ; BullMQ, argon2, jose, fast-check, Testcontainers, etc. auront leur ADR au moment de leur ajout.

## Décisions

| Dépendance | Pourquoi |
|---|---|
| `hono`, `@hono/node-server` | framework HTTP imposé ; middleware intégrés (CORS, secure headers, body limit, timeout) |
| `zod` | validation de la configuration au démarrage (fail fast) ; validation d'entrée ensuite |
| `pino` | logs structurés rapides avec redaction intégrée (PIN, OTP, jetons, numéros) |
| `@prisma/client`, `prisma` | accès PostgreSQL et migrations ; schéma multi-fichiers, un fichier par module |
| `ioredis` | client Redis (sonde de santé ; rate limit et BullMQ en Phase 1) |
| `typescript`, `tsx` | compilation stricte ; exécution en développement sans étape de build |
| `vitest`, `@vitest/coverage-v8` | tests et couverture |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | lint ; règle `no-explicit-any` |
| `prettier` | formatage |
| `dependency-cruiser` | règles de frontières et cycles en CI (doublon du test d'architecture) |

## Choix d'outillage

- **pnpm** : installations strictes (pas de dépendances fantômes), rapide ; scripts de build des dépendances autorisés explicitement (`onlyBuiltDependencies`).
- **ESM + `NodeNext`** : imports relatifs avec extension `.js`, sans bundler.
- **Pas de décorateurs ni de framework d'injection** : conteneur typé écrit à la main (`app/core/support/container.ts`).

## Conséquences

Les versions sont des plages `^` écrites sans accès au registre : à revoir après la première installation, puis figées par `pnpm-lock.yaml`.
