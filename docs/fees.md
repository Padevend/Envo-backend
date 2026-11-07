# Frais des opérations externes

L'utilisateur supporte **deux frais**, toujours affichés clairement avant qu'il confirme :

| Frais | Qui les fixe | Où se configurent-ils |
|---|---|---|
| **Frais MeSomb** | MeSomb, selon le **pays**, le **moyen de paiement** (MTN, Orange…) et le **sens** (recharge ou envoi) | `config/fees.json`, section `mesomb` |
| **Frais de l'application** | Nous : très faibles, **1 % maximum** par transaction (plafond imposé par la validation) | `config/fees.json`, section `appFee` |

Les transferts internes (wallet ↔ enveloppe ↔ objectif, règles automatiques) n'appellent jamais MeSomb et sont **gratuits** : `appliesTo` ne contient que `COLLECT` et `PAYOUT`.

## Modifier le barème (sans toucher au code)

1. Éditer `config/fees.json` (JSON, montants en XAF **écrits entre guillemets**).
2. Redémarrer l'API et le worker : `docker compose restart api worker` (Compose monte le fichier : pas de rebuild).
3. Si le fichier est invalide, **l'application refuse de démarrer** et liste les chemins fautifs (jamais les valeurs).

Un changement ne s'applique qu'aux opérations **futures**. Les frais d'une opération sont calculés une fois, au moment du devis, et enregistrés avec elle (Phase 4) : un client ne voit jamais deux prix différents entre l'aperçu et la confirmation.

## Format

```json
{
  "version": 1,
  "currency": "XAF",
  "appFee": { "bps": 50, "min": "0", "max": null, "rounding": "HALF_UP", "appliesTo": ["COLLECT", "PAYOUT"] },
  "mesomb": {
    "CM": {
      "MTN_MOMO": {
        "COLLECT": {
          "enabled": true,
          "verified": true,
          "note": "Source : documentation MeSomb du <date>",
          "tiers": [
            { "upTo": "5000", "fixed": "100", "bps": 0 },
            { "upTo": null, "fixed": "0", "bps": 200 }
          ],
          "min": "100",
          "max": "5000",
          "rounding": "CEIL"
        },
        "PAYOUT": { "...": "même structure" }
      },
      "ORANGE_MONEY": { "...": "même structure" }
    }
  }
}
```

| Champ | Sens |
|---|---|
| `mesomb.<PAYS>` | code pays ISO 3166-1 alpha-2 en majuscules (`CM`, `SN`, `CI`…) |
| `<MOYEN>` | identifiant libre en majuscules (`MTN_MOMO`, `ORANGE_MONEY`…) ; à aligner avec le moyen de paiement choisi dans l'application |
| `COLLECT` / `PAYOUT` | recharge (argent qui entre) / retrait ou envoi (argent qui sort) |
| `enabled` | `false` = l'opération est **refusée** (`fee_not_configured`) |
| `verified` | `true` seulement si le barème a été vérifié dans la documentation officielle (un test refuse un barème activé non vérifié) |
| `tiers` | paliers par montant : le premier dont `upTo` (**inclus**) est ≥ au montant s'applique ; le **dernier** a `upTo: null` ; bornes strictement croissantes |
| `fixed` | partie fixe du palier, en XAF |
| `bps` | partie proportionnelle en points de base : 100 bps = 1 %, 50 bps = 0,5 % |
| `min` / `max` | plancher / plafond des frais (`max: null` = pas de plafond) |
| `rounding` | `CEIL` (arrondi supérieur), `FLOOR` (inférieur), `HALF_UP` (à la moitié supérieure) |

## Calcul

```
frais_palier = fixed + arrondi(montant × bps / 10 000)
frais        = borné entre min et max
total        = frais MeSomb + frais application
```

Calcul exact en entiers (`bigint`), jamais de flottant. Exemples avec le barème ci-dessus et 0,5 % côté application :

| Opération | Montant | Frais MeSomb | Frais app | Effet sur le wallet |
|---|---|---|---|---|
| Recharge | 1 000 | 100 | 5 | **+895** (montant − frais) |
| Envoi | 100 000 | 2 000 | 500 | **−102 500** (montant + frais) |
| Envoi | 1 000 000 | 5 000 (plafond) | 5 000 | −1 010 000 |

Une recharge dont les frais atteignent le montant est refusée (`fee_exceeds_amount`).

## Écritures du ledger

| Opération | Lignes (somme nulle) |
|---|---|
| Recharge de `M` | `EXTERNAL −M`, `wallet +(M − frais)`, `FEES_MESOMB +frais MeSomb`, `FEES_APP +frais app` |
| Envoi de `M` | `wallet −(M + frais)`, `TRANSIT +M`, `FEES_MESOMB +frais MeSomb`, `FEES_APP +frais app` |

Les frais MeSomb et les frais de l'application sont sur **deux comptes distincts** : la comptabilité voit d'un coup d'œil ce qui couvre MeSomb et ce qui est le revenu de l'application. Le mode exact de prélèvement des frais par MeSomb (sur le solde marchand, à la collecte ou au versement) reste **TODO(verify)** et sera fixé en Phase 4.

## Ajouter un pays ou un moyen de paiement

1. Relever le barème dans la documentation officielle MeSomb (frais par opération, paliers, plafonds).
2. Ajouter le pays et le moyen sous `mesomb`, avec `COLLECT` et/ou `PAYOUT`.
3. Renseigner `note` (source et date), puis `enabled: true` et `verified: true`.
4. Redémarrer l'API et le worker.

## Important

**Aucun barème MeSomb réel n'est fourni** : le fichier livré contient des règles `enabled: false`, car les frais n'ont pas été vérifiés (TODO(verify), voir `docs/open-questions.md`). Tant qu'une règle est absente ou désactivée, l'opération correspondante est refusée plutôt que facturée à tort. Les frais de l'application sont fixés à 0,5 % par défaut (à confirmer).
