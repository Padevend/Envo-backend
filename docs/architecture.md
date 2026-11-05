# Architecture

Monolithe modulaire : un seul déploiement, des modules à frontières nettes, extractibles plus tard.

## Flux d'une requête

```
route → middleware → validator → controller → service (cas d'usage) → repository → Prisma
```

- **Model** : entités de domaine, value objects, repositories (seuls à parler à Prisma).
- **View** : transformers (jamais d'objet Prisma renvoyé tel quel).
- **Controller** : adaptateur HTTP mince.

Middleware globaux (voir `start/kernel.ts`) : `request_id → access_log → secure_headers → cors → body_limit → timeout → rate_limit` (Phase 1). Les erreurs passent par `app.onError` et sortent en `application/problem+json` avec un `code` stable et le `requestId`.

## Disposition

| Dossier | Rôle |
|---|---|
| `bin/` | points d'entrée (`server.ts` ; `worker.ts` et `console.ts` en Phase 1) |
| `config/` | un fichier par domaine, schéma Zod ; `index.ts` assemble et valide |
| `start/` | composition : `env`, `container`, `kernel`, `routes`, `app` |
| `app/core/` | noyau partagé, sans logique métier, ne dépend d'aucun module |
| `app/modules/<nom>/` | un module métier (anatomie : controllers, validators, transformers, services, models, repositories, policies, events, listeners, jobs, exceptions, `contracts.ts`, `routes.ts`, `provider.ts`, `index.ts`) |
| `app.rc.ts` | registre des modules (ordre de chargement des providers) |
| `prisma/schema/` | `base.prisma` + un fichier par module |

## Règles de frontières (vérifiées par `tests/architecture.test.ts` et `.dependency-cruiser.cjs`)

1. Un module n'importe un autre module que via son `index.ts`.
2. `app/core` ne dépend d'aucun module ; `app/` ne dépend ni de `start/` ni de `bin/`.
3. `@prisma/client` n'est importé que depuis `repositories/` (et `app/core`).
4. Aucun cycle de dépendances.
5. (Phase 2) Seul `ledger` écrit dans `journal_entries` et `postings`.

## Conteneur de dépendances

`app/core/support/container.ts` : conteneur typé, sans réflexion. `Registry` est une interface que chaque module étend par fusion de déclarations dans son `contracts.ts` (ex. `healthProbes` pour `system`). Les ressources externes passent par des ports remplaçables en test (`Clock`, `IdGenerator`, plus tard `PaymentGateway`, `SmsSender`, `PushSender`).

`createApp(container)` (dans `start/app.ts`) construit l'application sans serveur : tout est testable avec `app.request()`.

## État (Phase 0)

| Module | État |
|---|---|
| `system` | complet : `/health/live`, `/health/ready`, `/health/version` |
| 11 autres | squelettes (`index.ts`, `contracts.ts`, `provider.ts`) |
