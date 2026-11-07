import { Money } from '../../../core/money/money.js'
import type {
  HistoryPage,
  HistoryQuery,
  InvariantReport,
  InvariantViolation,
  LedgerOptions,
} from '../contracts.js'
import { ledgerErrors } from '../exceptions/ledger_error.js'
import type { AccountRepository } from '../repositories/account_repository.js'
import type { EntryRepository } from '../repositories/entry_repository.js'
import type { InvariantRepository } from '../repositories/invariant_repository.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const CURSOR_PATTERN = /^\d{1,18}$/

export interface ReportServiceDeps {
  accounts: AccountRepository
  entries: EntryRepository
  invariants: InvariantRepository
}

export class ReportService {
  constructor(private readonly deps: ReportServiceDeps) {}

  async balanceOf(accountId: string, options: LedgerOptions = {}): Promise<Money> {
    const account = await this.deps.accounts.findById(accountId, options.tx)
    if (account === null) {
      throw ledgerErrors.accountNotFound()
    }
    return account.balance
  }

  async history(accountId: string, query: HistoryQuery = {}): Promise<HistoryPage> {
    if ((await this.deps.accounts.findById(accountId)) === null) {
      throw ledgerErrors.accountNotFound()
    }
    if (query.cursor !== undefined && !CURSOR_PATTERN.test(query.cursor)) {
      throw ledgerErrors.invalidEntry('Curseur invalide.')
    }
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const cursor = query.cursor === undefined ? undefined : BigInt(query.cursor)

    const rows = await this.deps.entries.history(accountId, cursor, limit)
    const items = rows.slice(0, limit)
    const last = items[items.length - 1]
    return {
      items,
      nextCursor: rows.length > limit && last !== undefined ? last.seq.toString() : null,
    }
  }

  /** Balayage complet : somme nulle par écriture, cache = somme des lignes, aucun solde interdit négatif, total général nul. */
  async checkInvariants(): Promise<InvariantReport> {
    const raw = await this.deps.invariants.collect()
    const violations: InvariantViolation[] = []

    for (const entry of raw.unbalancedEntries) {
      violations.push({ code: 'UNBALANCED_ENTRY', detail: `écriture ${entry.entryId} : somme ${entry.total}` })
    }
    for (const account of raw.cacheMismatches) {
      violations.push({
        code: 'CACHE_MISMATCH',
        detail: `compte ${account.accountId} : cache ${account.cached}, recalculé ${account.computed}`,
      })
    }
    for (const account of raw.negativeBalances) {
      violations.push({
        code: 'NEGATIVE_BALANCE',
        detail: `compte ${account.accountId} : solde ${account.balance}`,
      })
    }

    const total = (kind: string): bigint => raw.totalsByKind.get(kind) ?? 0n
    const users = total('USER_WALLET') + total('USER_ENVELOPE') + total('USER_GOAL')
    const grandTotal = [...raw.totalsByKind.values()].reduce((sum, value) => sum + value, 0n)
    if (grandTotal !== 0n) {
      violations.push({ code: 'NON_ZERO_TOTAL', detail: `somme de tous les soldes : ${grandTotal}` })
    }

    return {
      ok: violations.length === 0,
      violations,
      totals: {
        external: Money.of(total('SYSTEM_EXTERNAL')),
        users: Money.of(users),
        feesMesomb: Money.of(total('SYSTEM_FEES_MESOMB')),
        feesApp: Money.of(total('SYSTEM_FEES_APP')),
        transit: Money.of(total('SYSTEM_TRANSIT')),
        suspense: Money.of(total('SYSTEM_SUSPENSE')),
        expectedMerchantBalance: Money.of(-total('SYSTEM_EXTERNAL')),
      },
    }
  }
}
