import { DomainException } from '../../../core/exceptions/domain_exception.js'

export class FeeError extends DomainException {
  constructor(code: string, title: string) {
    super({ code, title, status: 422 })
    this.name = 'FeeError'
  }
}

export const feeErrors = {
  notConfigured: () =>
    new FeeError('fee_not_configured', 'Opération indisponible pour ce pays ou ce moyen de paiement'),
  exceedsAmount: () => new FeeError('fee_exceeds_amount', 'Le montant ne couvre pas les frais'),
  invalidAmount: () => new FeeError('fee_invalid_amount', 'Montant invalide'),
}

/** Erreur de lecture ou de validation du fichier de frais (au démarrage : l'application refuse de démarrer). */
export class FeeScheduleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeeScheduleError'
  }
}
