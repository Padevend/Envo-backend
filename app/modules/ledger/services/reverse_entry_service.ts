import type { Tx, Transactional } from '../../../core/database/unit_of_work.js'
import type { Clock } from '../../../core/support/clock.js'
import type { JournalEntry, NewEntry, ReverseOptions } from '../contracts.js'
import { ledgerErrors, LedgerError } from '../exceptions/ledger_error.js'
import type { EntryRepository } from '../repositories/entry_repository.js'
import type { PostEntryService } from './post_entry_service.js'

export interface ReverseEntryDeps {
  uow: Transactional
  entries: EntryRepository
  poster: PostEntryService
  clock: Clock
}

/**
 * Contre-passation : une nouvelle écriture aux montants opposés, liée à l'originale (une seule par écriture).
 * Refusée si elle rendrait un compte négatif (les fonds ont été dépensés) : un administrateur règle alors le cas
 * par une écriture d'ajustement via le compte SUSPENSE.
 */
export class ReverseEntryService {
  constructor(private readonly deps: ReverseEntryDeps) {}

  reverse(entryId: string, options: ReverseOptions = {}): Promise<JournalEntry> {
    const { tx } = options
    return tx === undefined
      ? this.deps.uow.run((inner) => this.reverseWithin(inner, entryId, options.reason))
      : this.reverseWithin(tx, entryId, options.reason)
  }

  private async reverseWithin(tx: Tx, entryId: string, reason: string | undefined): Promise<JournalEntry> {
    const { entries, poster, clock } = this.deps
    const original = await entries.findById(tx, entryId)
    if (original === null) {
      throw ledgerErrors.entryNotFound()
    }
    if (original.kind === 'REVERSAL' || original.reversesEntryId !== null) {
      throw ledgerErrors.reversalNotAllowed('Une contre-passation ne se contre-passe pas.')
    }
    const alreadyReversed = await entries.findReversalOf(tx, entryId)
    if (alreadyReversed !== null) {
      return alreadyReversed
    }

    const reversal: NewEntry = {
      kind: 'REVERSAL',
      idempotencyKey: `reversal:${entryId}`,
      postings: original.postings.map((posting) => ({
        accountId: posting.accountId,
        amount: posting.amount.negate(),
      })),
      occurredAt: clock.now(),
      description: reason ?? 'Contre-passation',
      metadata: { reversesEntryId: entryId },
    }
    try {
      return await poster.postWithin(tx, reversal, { reversesEntryId: entryId })
    } catch (error) {
      if (error instanceof LedgerError && error.code === 'ledger_insufficient_funds') {
        throw ledgerErrors.reversalWouldOverdraw()
      }
      throw error
    }
  }
}
