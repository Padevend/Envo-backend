import type { Money } from '../../core/money/money.js'

export const FEE_OPERATIONS = ['COLLECT', 'PAYOUT'] as const

/** COLLECT = recharge (argent qui entre via MeSomb) ; PAYOUT = retrait ou envoi (argent qui sort). */
export type FeeOperation = (typeof FEE_OPERATIONS)[number]

export interface FeeQuoteInput {
  operation: FeeOperation
  /** Code pays ISO 3166-1 alpha-2 (ex. "CM"). */
  country: string
  /** Moyen de paiement tel que nommé dans config/fees.json (ex. "MTN_MOMO", "ORANGE_MONEY"). */
  provider: string
  amount: Money
}

export interface FeeQuote {
  operation: FeeOperation
  country: string
  provider: string
  /** Montant de l'opération : débité sur le mobile du client (COLLECT) ou reçu par le bénéficiaire (PAYOUT). */
  amount: Money
  mesombFee: Money
  appFee: Money
  totalFees: Money
  /** Effet sur le wallet de l'utilisateur : COLLECT = +(montant − frais), PAYOUT = −(montant + frais). */
  walletDelta: Money
}

export interface FeeCalculatorApi {
  /** Calcule les frais (MeSomb + application, supportés par l'utilisateur). Refuse si le barème est absent ou désactivé. */
  quote(input: FeeQuoteInput): FeeQuote
  isAvailable(country: string, provider: string, operation: FeeOperation): boolean
}

declare module '../../core/support/container.js' {
  interface Registry {
    feeCalculator: FeeCalculatorApi
  }
}
