import type { JsonObject } from '../../core/database/json.js'
import type { Tx } from '../../core/database/unit_of_work.js'
import type { Money } from '../../core/money/money.js'

// Convention de signe : montant > 0 crédite le compte, montant < 0 le débite. Somme nulle par écriture.

export const SYSTEM_ACCOUNT_CODES = [
  'EXTERNAL',
  'TRANSIT',
  'FEES_MESOMB',
  'FEES_APP',
  'SUSPENSE',
] as const
export type SystemAccountCode = (typeof SYSTEM_ACCOUNT_CODES)[number]

export const USER_ACCOUNT_KINDS = ['USER_WALLET', 'USER_ENVELOPE', 'USER_GOAL'] as const
export type UserAccountKind = (typeof USER_ACCOUNT_KINDS)[number]

export type AccountKind =
  | UserAccountKind
  | 'SYSTEM_EXTERNAL'
  | 'SYSTEM_TRANSIT'
  | 'SYSTEM_FEES_MESOMB'
  | 'SYSTEM_FEES_APP'
  | 'SYSTEM_SUSPENSE'

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED'

export type EntryKind =
  | 'TOPUP'
  | 'PAYOUT_RESERVE'
  | 'PAYOUT_SETTLE'
  | 'TRANSFER'
  | 'RULE_ALLOCATION'
  | 'REVERSAL'
  | 'ADJUSTMENT'

export interface LedgerAccount {
  id: string
  kind: AccountKind
  code: string | null
  ownerUserId: string | null
  status: AccountStatus
  allowsNegative: boolean
  /** Solde en cache (recalculable depuis les lignes, voir `checkInvariants`). */
  balance: Money
  createdAt: Date
}

export interface NewPosting {
  accountId: string
  /** Signé : > 0 crédite le compte, < 0 le débite. Jamais zéro. */
  amount: Money
}

export interface NewEntry {
  kind: EntryKind
  /** Clé d'idempotence unique : rejouer la même écriture renvoie l'écriture existante, sans nouvel effet. */
  idempotencyKey: string
  /** Au moins deux lignes, comptes distincts, somme nulle. */
  postings: readonly NewPosting[]
  occurredAt?: Date
  externalRef?: string
  description?: string
  metadata?: JsonObject
}

export interface Posting {
  id: string
  seq: bigint
  lineNo: number
  accountId: string
  amount: Money
  balanceAfter: Money
}

export interface JournalEntry {
  id: string
  kind: EntryKind
  idempotencyKey: string
  externalRef: string | null
  reversesEntryId: string | null
  description: string | null
  occurredAt: Date
  createdAt: Date
  postings: Posting[]
}

export interface HistoryItem {
  postingId: string
  seq: bigint
  entryId: string
  kind: EntryKind
  amount: Money
  balanceAfter: Money
  occurredAt: Date
  description: string | null
  externalRef: string | null
}

export interface HistoryQuery {
  /** Curseur opaque renvoyé par la page précédente. */
  cursor?: string
  limit?: number
}

export interface HistoryPage {
  items: HistoryItem[]
  nextCursor: string | null
}

export interface OpenAccountInput {
  kind: UserAccountKind
  ownerUserId: string
}

export interface LedgerOptions {
  /** Transaction de l'appelant (même commit que ses autres écritures, ex. l'outbox). Sinon le ledger ouvre la sienne. */
  tx?: Tx
}

export interface ReverseOptions extends LedgerOptions {
  reason?: string
}

export interface InvariantViolation {
  code: 'UNBALANCED_ENTRY' | 'CACHE_MISMATCH' | 'NEGATIVE_BALANCE' | 'NON_ZERO_TOTAL'
  detail: string
}

export interface LedgerTotals {
  external: Money
  users: Money
  feesMesomb: Money
  feesApp: Money
  transit: Money
  suspense: Money
  /**
   * Solde marchand MeSomb attendu : −EXTERNAL. TODO(verify) : à confirmer selon la façon dont MeSomb prélève ses
   * frais (Phase 4) ; la réconciliation (Phase 6) le compare au solde réel.
   */
  expectedMerchantBalance: Money
}

export interface InvariantReport {
  ok: boolean
  violations: InvariantViolation[]
  totals: LedgerTotals
}

/** API publique du module `ledger` : seul point d'entrée pour déplacer de l'argent en interne. */
export interface LedgerApi {
  post(entry: NewEntry, options?: LedgerOptions): Promise<JournalEntry>
  /** Contre-passe une écriture (une seule fois). Refusée si elle rendrait un compte négatif. */
  reverse(entryId: string, options?: ReverseOptions): Promise<JournalEntry>
  balanceOf(accountId: string, options?: LedgerOptions): Promise<Money>
  history(accountId: string, query?: HistoryQuery): Promise<HistoryPage>
  getAccount(accountId: string, options?: LedgerOptions): Promise<LedgerAccount>
  accountsOf(ownerUserId: string, options?: LedgerOptions): Promise<LedgerAccount[]>
  openAccount(input: OpenAccountInput, options?: LedgerOptions): Promise<LedgerAccount>
  /** Un compte gelé refuse les débits (objectif verrouillé, gel administratif) mais accepte les crédits. */
  freezeAccount(accountId: string, options?: LedgerOptions): Promise<LedgerAccount>
  unfreezeAccount(accountId: string, options?: LedgerOptions): Promise<LedgerAccount>
  /** Fermeture définitive : le solde doit être nul. */
  closeAccount(accountId: string, options?: LedgerOptions): Promise<LedgerAccount>
  systemAccountId(code: SystemAccountCode): Promise<string>
  checkInvariants(): Promise<InvariantReport>
}

declare module '../../core/support/container.js' {
  interface Registry {
    ledger: LedgerApi
  }
}
