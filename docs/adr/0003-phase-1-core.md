# ADR 0003 — Phase 1 : noyau transactionnel (Money, UnitOfWork, idempotence, outbox, queues, crypto, rate limit)

- **Statut** : proposée (non exécutée hors CI ; décisions marquées À CONFIRMER)
- **Date** : 2026-11-05

## Dépendance ajoutée

| Dépendance | Pourquoi |
|---|---|
| `bullmq` | file de jobs sur Redis imposée par le cahier : jobs répétables (`upsertJobScheduler`, fuseau Africa/Douala), tentatives avec backoff, conservation des échecs. Version `^5.34` (planificateurs de jobs). |

Aucune autre dépendance : `node:crypto` couvre AES-GCM, HMAC, SHA-256 et l'aléa ; `argon2`, `jose`, `fast-check` arriveront avec leur phase.

## Décisions

### Argent
- `Money` : `bigint`, immuable, sérialisé en chaîne. `parse` est strict (pas de zéros en tête, de `+`, de `-0`, de décimales). `allocate` répartit selon des poids entiers : chaque part est arrondie vers zéro, le reste va à la part désignée (la somme est exacte).

### Transactions
- `UnitOfWork.run` : isolation **Serializable par défaut**, jusqu'à 5 tentatives avec backoff exponentiel à jitter complet sur conflit (`P2034`, SQLSTATE `40001`/`40P01`). L'opération peut donc être rejouée : aucun effet de bord hors de `tx`.
- Les services dépendent de l'interface `Transactional`, pas de Prisma : testable sans base.

### Idempotence HTTP
- Clé = UUID dans `Idempotency-Key`, portée par (utilisateur, clé, `METHODE chemin`). Verrou pris par insertion unique (atomique entre plusieurs processus).
- Même clé + corps ou requête différents → 422. Requête en cours → 409 + `Retry-After`. Terminée → réponse rejouée (`Idempotency-Replayed: true`).
- Les réponses **2xx et 4xx sont mémorisées** ; les **5xx libèrent le verrou** (le client peut réessayer ; l'opération métier reste protégée par la clé d'idempotence du ledger). Verrou jamais libéré (processus mort) repris après 60 s. TTL 48 h, purge horaire par job. **À CONFIRMER.**
- `IdempotencyKey` vit dans `prisma/schema/core.prisma` (transverse, sans clé étrangère vers `users`). **La Phase 3 ne doit pas le re-déclarer** en portant `security.prisma`.

### Événements et outbox
- `OutboxPublisher.publish(tx, type, payload)` écrit l'événement dans la transaction de l'appelant : il existe si et seulement si l'opération est validée.
- Le relais réserve un lot avec un **bail** (`next_attempt_at` repoussé, `attempts` incrémenté à la réservation, `FOR UPDATE SKIP LOCKED`) : un relais mort ne bloque rien, un événement empoisonné finit en `DEAD` après `OUTBOX_MAX_ATTEMPTS` (jamais supprimé).
- Livraison **au moins une fois** vers le bus, rendue **une fois par listener** par la table `listener_deliveries` (insertion `ON CONFLICT DO NOTHING` dans la transaction du listener : si le listener échoue, tout est annulé, y compris la livraison).
- Le type des événements est ouvert par fusion d'interface (`DomainEventMap`), comme `Registry` pour le conteneur.

### Rate limit
- Fenêtre glissante exacte en Lua (ensemble trié Redis), atomique. Limiteur global : 120 requêtes/min/IP par défaut, `/health` exclu.
- **Redis indisponible** : le limiteur global laisse passer (disponibilité). Les limiteurs d'OTP et de PIN (Phase 3) utiliseront `onBackendError: 'deny'`. **À CONFIRMER.**
- `X-Forwarded-For` n'est lu que si `TRUST_PROXY=true` (derrière Caddy, API non exposée directement).

### Crypto
- AES-256-GCM, IV de 12 octets aléatoire, format `v<version>.<iv>.<chiffré>.<tag>`. Le paramètre `aad` lie un message à son contexte. Rotation : ajouter une version dans `ENCRYPTION_KEYS`, changer `ENCRYPTION_ACTIVE_KEY_VERSION`, garder les anciennes ; `needsRotation` repère les valeurs à réécrire.
- `BLIND_INDEX_KEY` est distincte des clés de chiffrement. La changer invalide tous les index aveugles.
- Les clés sont **obligatoires au démarrage** (32 octets en base64, version active présente), sans valeur par défaut ; les messages d'erreur ne reprennent jamais leur valeur.

### Jobs
- Worker dans un processus séparé (`bin/worker.ts`, service `worker` de Compose). Backoff exponentiel avec jitter, 5 tentatives, échecs conservés 7 jours, file `dead-letter` (métadonnées uniquement, jamais les données du job).
- Planification : relais de l'outbox toutes les 2 s ; purge d'idempotence à la minute 17 de chaque heure.

### Migrations
- Première migration écrite à la main (`prisma/migrations/20261105120000_core_foundation`) : `system_flags`, `idempotency_keys`, `outbox_events`, `listener_deliveries`. Elle est **appliquée par la CI** (`prisma migrate deploy`) : une erreur de SQL fait échouer la CI.
- Écart avec le prompt : les migrations sont dans `prisma/migrations` (emplacement attendu par Prisma pour un schéma multi-fichiers), pas dans `database/migrations`. Le SQL personnalisé (triggers d'immuabilité) arrive en Phase 2.
- Compose : un service `migrate` (cible Docker `migrate`) s'exécute avant `api` et `worker`.

## Écarts et reports

- **Pas de Testcontainers** : la CI fournit de vrais Postgres et Redis (services GitHub Actions) ; les tests d'intégration (`tests/integration`, `RUN_INTEGRATION=1`) s'y connectent. Testcontainers pourra être ajouté pour les scénarios de chaos de la Phase 4.
- `fast-check` (propriétés sur le ledger) : Phase 2.
- Métriques et Sentry : Phase 7.
- Aucun endpoint n'applique encore l'idempotence : le middleware est prêt, branché route par route à partir de la Phase 3 (`resolveScope` = identifiant de l'utilisateur authentifié).

## Risques

- **Rien de cette phase n'a été exécuté avant la CI** (pas de réseau à la rédaction). Zones les moins sûres : typage de l'API BullMQ, requête SQL brute du relais, script Lua, migration écrite à la main (dérive possible avec `prisma migrate dev`).
