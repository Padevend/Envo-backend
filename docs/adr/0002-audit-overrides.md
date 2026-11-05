# ADR 0002 — Overrides de dépendances transitives (audit)

- **Statut** : acceptée, temporaire
- **Date** : 2026-11-05

## Contexte

`pnpm audit --audit-level=high` bloque la CI. Deux avis concernent des dépendances transitives d'outils de développement (jamais présentes dans l'image de production, qui exécute `pnpm prune --prod`) :

| Paquet | Avis | Gravité | Tiré par | Correctif |
|---|---|---|---|---|
| `tinypool` | GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr | critique | `vitest` 3.x | >= 2.1.2 |
| `deepmerge-ts` | GHSA-ggr8-5vv4-36mx | élevée | `prisma` 6.x (`@prisma/config`) | >= 8.0.0 |

Aucune version corrigée de `vitest` 3.x ni de `prisma` 6.x ne les embarque.

## Décision

Forcer les versions corrigées via `pnpm.overrides` dans `package.json`, en gardant le seuil d'audit à `high`.

## Risques et sortie

- Les versions forcées sont des majeures différentes de celles attendues par leurs parents : si les tests ou la génération Prisma se comportent mal, la CI le montrera. Repli : migrer `vitest` vers sa version majeure suivante, qui n'embarque plus `tinypool`.
- **Retirer ces overrides** dès que `vitest` et `prisma` publient des versions qui embarquent les correctifs (Prisma 7 impose par ailleurs une migration de la configuration : `prisma.config.ts`, nouveau générateur).
