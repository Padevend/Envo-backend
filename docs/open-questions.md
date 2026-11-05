# Questions ouvertes et décisions à confirmer

Légende : **À CONFIRMER** = défaut pris en Phase 0 faute de réponse explicite ; **TODO(verify)** = comportement externe non confirmé, ne pas le considérer comme acquis.

## Décisions prises par défaut en Phase 0

| # | Sujet | Défaut pris | Statut |
|---|---|---|---|
| 1 | Branches | commit initial sur `main`, une branche + PR par phase | À CONFIRMER |
| 2 | Gestionnaire de paquets | **pnpm** partout (scripts, CI, Docker). npm non utilisé : préciser s'il l'est pour un usage particulier | À CONFIRMER |
| 3 | Node.js | 24 (`.nvmrc`, Docker), `engines >= 22.12`. TODO(verify) : version LTS « actuelle » au moment du déploiement | À CONFIRMER |
| 4 | Prisma | `^6.7` (schéma multi-fichiers GA), colonnes en snake_case via `@map`. TODO(verify) : Prisma 7 déplace l'URL de connexion hors du schéma | À CONFIRMER |
| 5 | Rôle SQL applicatif (`app_role` dans `security.sql`) | propriétaire pour les migrations, rôle restreint pour l'API ; nom à définir | À CONFIRMER |
| 6 | Fournisseur SMS (OTP) | simulateur derrière le port `SmsSender` ; choix réel en Phase 3 | À CONFIRMER |
| 7 | Modèle de conservation des fonds | modèle A du cahier des charges, ledger interne source de vérité | À CONFIRMER |
| 8 | Step-up pour transfert interne | ajouter le scope `TRANSFER_INTERNAL` (absent de `StepUpScope`) | À CONFIRMER |
| 9 | Audit chaîné par hash | sérialisation des écritures par verrou consultatif Postgres (goulot accepté pour le MVP) | À CONFIRMER |

## Limites de la Phase 0

- **Rien n'a été exécuté** : l'environnement de rédaction n'avait pas de réseau (pas d'installation, ni lint, typecheck, tests). Le code est à valider par la CI et en local.
- Versions des dépendances : plages (`^`) écrites de mémoire, **non vérifiées** contre le registre. À revoir après `pnpm install`.
- `pnpm-lock.yaml` absent : à générer (`pnpm install`) et commiter ; la CI tolère son absence pour l'instant.
- Configuration `dependency-cruiser` (résolution `.js` → `.ts`, référence `$1`) non testée ; le test d'architecture Vitest est la vérification de référence.
- Actions GitHub référencées par tag majeur, pas par SHA.
- Dockerfile : `pnpm prune --prod` doit conserver le client Prisma généré ; à vérifier au premier build.
- Aucune migration : `SystemFlag` est décrit dans `prisma/schema/system.prisma` mais aucune migration n'est créée (Phase 2).
- Reporté aux phases concernées : `bin/worker.ts`, `bin/console.ts`, `start/events.ts`, `start/scheduler.ts`, `config/auth|security|mesomb|queue.ts`, middleware `rate_limit` et `idempotency`, service `worker` de Compose.

## MeSomb : à vérifier dans la documentation officielle avant la Phase 4

Tous marqués TODO(verify) ; aucun n'est confirmé.

- Webhooks : existence, événements, signature, politique de nouvelle tentative.
- Bac à sable : disponibilité, comportement des statuts de test.
- Plafonds et frais par opérateur (MTN, Orange).
- Lecture du solde marchand par API (nécessaire à l'invariant de solvabilité).
- Listage des transactions pour la réconciliation (filtres, pagination).
- Idempotence côté MeSomb sur un versement (référence client) et délais d'état « incertain ».
- Le cahier des charges fait de ce spike un jalon de la semaine 1 ; le prompt place `MesombGateway` en Phase 7. Proposition : lecture de la documentation dès maintenant, en parallèle.
