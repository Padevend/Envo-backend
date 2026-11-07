# ADR 0004 — Phase 2 : ledger et frais

- **Statut** : proposée (non exécutée hors CI ; décisions validées par le propriétaire sauf mention contraire)
- **Date** : 2026-11-06

## Dépendance ajoutée

| Dépendance | Pourquoi |
|---|---|
| `fast-check` (dev) | tests de propriétés exigés par le cahier : sur des séquences aléatoires d'opérations, la somme des écritures est nulle et aucun solde interdit n'est négatif ; propriétés de `Money.allocate`, des écritures et des frais. |

## Décisions

### Modèle
- Partie double : `journal_entries` + `postings` (montants signés : > 0 crédite, < 0 débite ; somme nulle par écriture ; ≥ 2 lignes ; comptes distincts). Comptes `ledger_accounts` avec solde **en cache**, recalculable (`checkInvariants`).
- `EXTERNAL` représente le monde extérieur : son solde négatif = argent entré dans le système. Seuls `EXTERNAL` et `SUSPENSE` peuvent être négatifs. Le total de tous les soldes vaut toujours 0.
- **Écart avec la proposition** : le compte `FEES` est scindé en `FEES_MESOMB` et `FEES_APP`, puisque l'utilisateur supporte deux frais de nature différente (coût prestataire / revenu de l'application).
- Un seul wallet par utilisateur (index unique partiel). Aucune clé étrangère vers `users` : le ledger ne dépend d'aucun module.
- Statut de compte `ACTIVE | FROZEN | CLOSED` : un compte gelé refuse les débits (objectifs verrouillés, gel administratif) ; le module `wallets` le gère en Phase 5. Fermeture possible seulement à solde nul.
- Contre-passation : une seule par écriture (`reverses_entry_id` unique), pas de contre-passation d'une contre-passation, **refusée si un solde deviendrait négatif** ; l'administrateur règle ensuite par un ajustement via `SUSPENSE`.
- Idempotence : `idempotency_key` unique. Rejouer le même contenu renvoie l'écriture existante ; un contenu différent lève `ledger_idempotency_conflict` (409). Deux requêtes concurrentes de même clé : l'une peut recevoir 409 (le client réessaie ; la couche HTTP de la Phase 1 sérialise déjà par clé).

### Garde-fous en base (migration `20261106100000_ledger`)
S'appliquent même si le code applicatif est contourné :
- triggers d'**immuabilité** (UPDATE/DELETE/TRUNCATE interdits sur `journal_entries` et `postings`, DELETE/TRUNCATE sur les comptes) ;
- trigger de ligne `postings_apply` : verrouille le compte, refuse compte fermé, débit d'un compte gelé et solde insuffisant, met à jour le **solde en cache** et fige `balance_after` ;
- le solde ne se modifie **que** par ce trigger (garde `pg_trigger_depth() >= 2` sur `ledger_accounts`) ; l'identité d'un compte (type, code, propriétaire, `allows_negative`) est immuable ;
- **somme nulle et deux lignes minimum vérifiées au COMMIT** (contraintes différées) ;
- `CHECK (allows_negative OR balance >= 0)`, montant de ligne non nul, cohérence type/propriétaire/code.

### Concurrence
Les comptes d'une écriture sont verrouillés (`SELECT ... FOR UPDATE`) dans l'ordre des identifiants, dans une transaction sérialisable du `UnitOfWork` (reprise bornée sur conflit ou interblocage). Les règles métier sont des fonctions pures (`entry_rules.ts`) testées par propriétés ; la base les re-vérifie.

### Frais
- Barème en JSON (`config/fees.json`, voir `docs/fees.md`) : MeSomb par pays, moyen de paiement et opération (paliers, fixe + points de base, plancher, plafond, arrondi) ; frais de l'application plafonnés à 100 points de base (1 %), 50 par défaut (à confirmer). Chargé et validé au démarrage (fail fast), modifiable sans rebuild.
- Le calculateur (`payments`) est pur ; le ledger ne connaît pas les frais : il reçoit des lignes. **Aucun barème MeSomb réel** n'est fourni (non vérifié) ; un test refuse un barème activé sans `verified: true`.

## Écarts et reports

- Pas de routes HTTP pour le ledger : il est interne ; les endpoints arrivent avec `wallets` (Phase 5) et `payments` (Phase 4).
- `expectedMerchantBalance = −EXTERNAL` est un point de départ : **TODO(verify)** selon la façon dont MeSomb prélève ses frais ; comparé au solde réel par la réconciliation (Phase 6).
- Pas d'API de recalcul/réparation du cache : un écart détecté est signalé, jamais corrigé en silence.

## Risques (rien n'a été exécuté avant la CI)

- Migration écrite à la main : triggers PL/pgSQL, contraintes différées, `BIGSERIAL` sur une colonne non identifiante, auto-relation de `journal_entries`. La CI l'applique ; une dérive avec `prisma migrate dev` est possible (index partiel, `CHECK` et triggers ne sont pas modélisés par Prisma).
- Les erreurs levées par les triggers sont repérées par le préfixe `ledger:` dans leur message ; leur mise en forme par Prisma est à confirmer au premier run.
- Test de concurrence : suppose que les reprises du `UnitOfWork` (10 tentatives dans ce test) suffisent à 10 transactions simultanées sur un même compte.
