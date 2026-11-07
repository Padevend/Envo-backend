import type { Tx, Transactional } from '../../../core/database/unit_of_work.js'
import type { Clock } from '../../../core/support/clock.js'
import type { JournalEntry, LedgerOptions, NewEntry } from '../contracts.js'
import { ledgerErrors, LedgerError } from '../exceptions/ledger_error.js'
import { evaluatePostings, validateEntryShape } from '../models/entry_rules.js'
import type { AccountRepository } from '../repositories/account_repository.js'
import type { EntryRepository } from '../repositories/entry_repository.js'

export interface PostEntryDeps {
  uow: Transactional
  accounts: AccountRepository
  entries: EntryRepository
  clock: Clock
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
}

/** Les triggers SQL sont le filet de sécurité : si l'un d'eux se déclenche, la règle applicative a été contournée ou a un trou. */
function translateInsertError(error: unknown): unknown {
  if (error instanceof LedgerError) {
    return error
  }
  if (isUniqueViolation(error)) {
    return ledgerErrors.idempotencyConflict()
  }
  if (error instanceof Error && error.message.includes('ledger:')) {
    return ledgerErrors.invariantViolation(error)
  }
  return error
}

function fingerprint(
  kind: string,
  externalRef: string | null,
  reversesEntryId: string | null,
  postings: ReadonlyArray<{ accountId: string; amount: { toString(): string } }>,
): string {
  const lines = postings.map((posting) => `${posting.accountId}:${posting.amount.toString()}`).sort()
  return [kind, externalRef ?? '', reversesEntryId ?? '', ...lines].join('|')
}

export class PostEntryService {
  constructor(private readonly deps: PostEntryDeps) {}

  post(entry: NewEntry, options: LedgerOptions = {}): Promise<JournalEntry> {
    const { tx } = options
    return tx === undefined
      ? this.deps.uow.run((inner) => this.postWithin(inner, entry))
      : this.postWithin(tx, entry)
  }

  /** Écrit l'écriture dans la transaction `tx`. Idempotent : la même clé avec le même contenu renvoie l'écriture existante. */
  async postWithin(
    tx: Tx,
    entry: NewEntry,
    extras: { reversesEntryId?: string } = {},
  ): Promise<JournalEntry> {
    validateEntryShape(entry)
    const { accounts, entries, clock } = this.deps
    const reverses = extras.reversesEntryId ?? null

    const existing = await entries.findByIdempotencyKey(tx, entry.idempotencyKey)
    if (existing !== null) {
      const same =
        fingerprint(existing.kind, existing.externalRef, existing.reversesEntryId, existing.postings) ===
        fingerprint(entry.kind, entry.externalRef ?? null, reverses, entry.postings)
      if (same) {
        return existing
      }
      throw ledgerErrors.idempotencyConflict()
    }

    const ids = [...new Set(entry.postings.map((posting) => posting.accountId))]
    const locked = await accounts.lockByIds(tx, ids)
    evaluatePostings(
      new Map(locked.map((account) => [account.id, account] as const)),
      entry.postings,
    )

    try {
      return await entries.insert(tx, {
        kind: entry.kind,
        idempotencyKey: entry.idempotencyKey,
        occurredAt: entry.occurredAt ?? clock.now(),
        postings: entry.postings,
        ...(entry.externalRef === undefined ? {} : { externalRef: entry.externalRef }),
        ...(reverses === null ? {} : { reversesEntryId: reverses }),
        ...(entry.description === undefined ? {} : { description: entry.description }),
        ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
      })
    } catch (error) {
      throw translateInsertError(error)
    }
  }
}
