import type { AccountStatus, NewEntry, NewPosting } from '../contracts.js'
import { ledgerErrors } from '../exceptions/ledger_error.js'

/** Compte tel que lu sous verrou (`SELECT ... FOR UPDATE`) : base des vérifications avant écriture. */
export interface LockedAccount {
  id: string
  status: AccountStatus
  allowsNegative: boolean
  balance: bigint
}

const MAX_KEY_LENGTH = 200
const MAX_REF_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 500

/** Forme d'une écriture : ≥ 2 lignes, montants non nuls, comptes distincts, somme nulle. Fonction pure. */
export function validateEntryShape(entry: NewEntry): void {
  if (entry.idempotencyKey.trim() === '' || entry.idempotencyKey.length > MAX_KEY_LENGTH) {
    throw ledgerErrors.invalidEntry('La clé d\'idempotence est requise (200 caractères maximum).')
  }
  if (entry.externalRef !== undefined && entry.externalRef.length > MAX_REF_LENGTH) {
    throw ledgerErrors.invalidEntry('La référence externe est trop longue.')
  }
  if (entry.description !== undefined && entry.description.length > MAX_DESCRIPTION_LENGTH) {
    throw ledgerErrors.invalidEntry('La description est trop longue.')
  }
  if (entry.postings.length < 2) {
    throw ledgerErrors.invalidEntry('Une écriture exige au moins deux lignes.')
  }

  const accountIds = new Set<string>()
  let total = 0n
  for (const posting of entry.postings) {
    if (posting.amount.isZero()) {
      throw ledgerErrors.invalidEntry('Une ligne ne peut pas être nulle.')
    }
    if (accountIds.has(posting.accountId)) {
      throw ledgerErrors.invalidEntry('Un compte ne peut apparaître qu\'une fois par écriture.')
    }
    accountIds.add(posting.accountId)
    total += posting.amount.value
  }
  if (total !== 0n) {
    throw ledgerErrors.unbalanced()
  }
}

/**
 * Applique les lignes aux soldes lus sous verrou et renvoie les nouveaux soldes, ou lève l'erreur métier
 * (compte inconnu, fermé, gelé en débit, solde insuffisant). Fonction pure : la base re-vérifie par trigger.
 */
export function evaluatePostings(
  accounts: ReadonlyMap<string, LockedAccount>,
  postings: readonly NewPosting[],
): Map<string, bigint> {
  const balances = new Map<string, bigint>()
  for (const posting of postings) {
    const account = accounts.get(posting.accountId)
    if (account === undefined) {
      throw ledgerErrors.accountNotFound()
    }
    if (account.status === 'CLOSED') {
      throw ledgerErrors.accountClosed()
    }
    if (account.status === 'FROZEN' && posting.amount.isNegative()) {
      throw ledgerErrors.accountFrozen()
    }
    const next = account.balance + posting.amount.value
    if (next < 0n && !account.allowsNegative) {
      throw ledgerErrors.insufficientFunds()
    }
    balances.set(account.id, next)
  }
  return balances
}
