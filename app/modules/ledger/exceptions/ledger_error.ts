import { DomainException, type DomainExceptionInit } from '../../../core/exceptions/domain_exception.js'

/** Erreur métier du ledger : `code` stable, jamais de détail interne (pas d'identifiants de compte). */
export class LedgerError extends DomainException {
  constructor(init: DomainExceptionInit) {
    super(init)
    this.name = 'LedgerError'
  }
}

export const ledgerErrors = {
  invalidEntry: (detail: string) =>
    new LedgerError({ code: 'ledger_invalid_entry', title: 'Écriture invalide', detail }),
  unbalanced: () =>
    new LedgerError({
      code: 'ledger_unbalanced_entry',
      title: 'Écriture déséquilibrée',
      detail: 'La somme des lignes doit être nulle.',
    }),
  accountNotFound: () =>
    new LedgerError({ code: 'ledger_account_not_found', title: 'Compte introuvable', status: 404 }),
  accountClosed: () => new LedgerError({ code: 'ledger_account_closed', title: 'Compte fermé' }),
  accountFrozen: () =>
    new LedgerError({ code: 'ledger_account_frozen', title: 'Compte gelé : débit refusé', status: 423 }),
  insufficientFunds: () =>
    new LedgerError({ code: 'ledger_insufficient_funds', title: 'Solde insuffisant' }),
  idempotencyConflict: () =>
    new LedgerError({
      code: 'ledger_idempotency_conflict',
      title: 'Clé d\'idempotence déjà utilisée par une autre écriture',
      status: 409,
    }),
  entryNotFound: () =>
    new LedgerError({ code: 'ledger_entry_not_found', title: 'Écriture introuvable', status: 404 }),
  reversalNotAllowed: (detail: string) =>
    new LedgerError({
      code: 'ledger_reversal_not_allowed',
      title: 'Contre-passation impossible',
      detail,
    }),
  reversalWouldOverdraw: () =>
    new LedgerError({
      code: 'ledger_reversal_would_overdraw',
      title: 'Contre-passation refusée : un solde deviendrait négatif',
    }),
  accountNotEmpty: () =>
    new LedgerError({ code: 'ledger_account_not_empty', title: 'Le solde du compte doit être nul' }),
  accountExists: () =>
    new LedgerError({ code: 'ledger_account_exists', title: 'Compte déjà existant', status: 409 }),
  invariantViolation: (cause: unknown) =>
    new LedgerError({
      code: 'ledger_invariant_violation',
      title: 'Violation d\'une règle du ledger',
      status: 500,
      cause,
    }),
}
