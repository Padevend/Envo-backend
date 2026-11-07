import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Money } from '../../app/core/money/money.js'
import type { NewEntry } from '../../app/modules/ledger/contracts.js'
import { LedgerError } from '../../app/modules/ledger/exceptions/ledger_error.js'
import {
  evaluatePostings,
  validateEntryShape,
  type LockedAccount,
} from '../../app/modules/ledger/models/entry_rules.js'

const entry = (postings: Array<[string, bigint]>, key = 'cle-1'): NewEntry => ({
  kind: 'TRANSFER',
  idempotencyKey: key,
  postings: postings.map(([accountId, amount]) => ({ accountId, amount: Money.of(amount) })),
})

function codeOf(operation: () => unknown): string | null {
  try {
    operation()
  } catch (error) {
    if (error instanceof LedgerError) {
      return error.code
    }
    throw error
  }
  return null
}

const account = (id: string, balance: bigint, overrides: Partial<LockedAccount> = {}): LockedAccount => ({
  id,
  status: 'ACTIVE',
  allowsNegative: false,
  balance,
  ...overrides,
})

const accountsMap = (...accounts: LockedAccount[]): Map<string, LockedAccount> =>
  new Map(accounts.map((item) => [item.id, item] as const))

describe('validateEntryShape', () => {
  it('accepte une écriture équilibrée', () => {
    expect(codeOf(() => validateEntryShape(entry([['a', -100n], ['b', 100n]])))).toBeNull()
  })

  it('refuse moins de deux lignes, une ligne nulle, un compte en double', () => {
    expect(codeOf(() => validateEntryShape(entry([['a', 0n]])))).toBe('ledger_invalid_entry')
    expect(codeOf(() => validateEntryShape(entry([['a', -5n], ['b', 0n], ['c', 5n]])))).toBe('ledger_invalid_entry')
    expect(codeOf(() => validateEntryShape(entry([['a', -5n], ['a', 5n]])))).toBe('ledger_invalid_entry')
  })

  it('refuse une écriture déséquilibrée', () => {
    expect(codeOf(() => validateEntryShape(entry([['a', -100n], ['b', 99n]])))).toBe('ledger_unbalanced_entry')
  })

  it('refuse une clé d\'idempotence vide ou trop longue', () => {
    expect(codeOf(() => validateEntryShape(entry([['a', -1n], ['b', 1n]], '  ')))).toBe('ledger_invalid_entry')
    expect(codeOf(() => validateEntryShape(entry([['a', -1n], ['b', 1n]], 'x'.repeat(201))))).toBe('ledger_invalid_entry')
  })

  it('propriété : toute écriture à somme nulle est acceptée, toute autre refusée', () => {
    const balanced = fc
      .array(fc.bigInt({ min: 1n, max: 10n ** 12n }), { minLength: 1, maxLength: 8 })
      .map((credits): Array<[string, bigint]> => {
        const total = credits.reduce((sum, value) => sum + value, 0n)
        return [...credits.map((value, index): [string, bigint] => [`acct-${index}`, value]), ['acct-debit', -total]]
      })

    fc.assert(
      fc.property(balanced, (postings) => {
        expect(codeOf(() => validateEntryShape(entry(postings)))).toBeNull()

        const [first, ...rest] = postings
        if (first !== undefined) {
          const skewed: Array<[string, bigint]> = [[first[0], first[1] + 1n], ...rest]
          expect(codeOf(() => validateEntryShape(entry(skewed)))).toBe('ledger_unbalanced_entry')
        }
      }),
    )
  })
})

describe('evaluatePostings', () => {
  it('applique les lignes et renvoie les nouveaux soldes', () => {
    const balances = evaluatePostings(
      accountsMap(account('a', 1_000n), account('b', 0n)),
      entry([['a', -400n], ['b', 400n]]).postings,
    )
    expect(balances.get('a')).toBe(600n)
    expect(balances.get('b')).toBe(400n)
  })

  it('refuse un solde insuffisant, sauf sur un compte qui autorise le négatif', () => {
    const postings = entry([['a', -400n], ['b', 400n]]).postings
    expect(codeOf(() => evaluatePostings(accountsMap(account('a', 399n), account('b', 0n)), postings))).toBe('ledger_insufficient_funds')
    expect(codeOf(() => evaluatePostings(accountsMap(account('a', 0n, { allowsNegative: true }), account('b', 0n)), postings))).toBeNull()
  })

  it('refuse un débit sur un compte gelé mais accepte un crédit', () => {
    const frozen = account('goal', 1_000n, { status: 'FROZEN' })
    expect(codeOf(() => evaluatePostings(accountsMap(frozen, account('b', 0n)), entry([['goal', -1n], ['b', 1n]]).postings))).toBe('ledger_account_frozen')
    expect(codeOf(() => evaluatePostings(accountsMap(frozen, account('b', 5n)), entry([['b', -1n], ['goal', 1n]]).postings))).toBeNull()
  })

  it('refuse un compte fermé ou inconnu', () => {
    const closed = account('c', 0n, { status: 'CLOSED' })
    expect(codeOf(() => evaluatePostings(accountsMap(closed, account('b', 5n)), entry([['b', -1n], ['c', 1n]]).postings))).toBe('ledger_account_closed')
    expect(codeOf(() => evaluatePostings(accountsMap(account('b', 5n)), entry([['b', -1n], ['inconnu', 1n]]).postings))).toBe('ledger_account_not_found')
  })

  it('propriété : un transfert réussit exactement quand le solde source le couvre, et conserve le total', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 2_000n }),
        fc.bigInt({ min: 0n, max: 2_000n }),
        fc.bigInt({ min: 1n, max: 2_500n }),
        (sourceBalance, targetBalance, amount) => {
          const accounts = accountsMap(account('src', sourceBalance), account('dst', targetBalance))
          const code = codeOf(() => {
            const next = evaluatePostings(accounts, entry([['src', -amount], ['dst', amount]]).postings)
            const before = sourceBalance + targetBalance
            const after = (next.get('src') ?? 0n) + (next.get('dst') ?? 0n)
            expect(after).toBe(before)
            expect(next.get('src') ?? -1n).toBeGreaterThanOrEqual(0n)
          })
          expect(code).toBe(sourceBalance >= amount ? null : 'ledger_insufficient_funds')
        },
      ),
    )
  })
})
