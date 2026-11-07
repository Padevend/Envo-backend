import { Money } from '../../../core/money/money.js'
import type { FeeCalculatorApi, FeeOperation, FeeQuote, FeeQuoteInput } from '../contracts.js'
import { feeErrors } from '../exceptions/fee_errors.js'
import { computeFee } from '../models/fee_math.js'
import { toFormula, type FeeRuleFile, type FeeScheduleFile } from '../models/fee_schedule.js'

/**
 * Frais d'une opération externe : frais MeSomb (selon pays, moyen de paiement et opération) + frais de
 * l'application, tous deux supportés par l'utilisateur. Fonction pure du barème : aucun I/O.
 */
export class FeeCalculator implements FeeCalculatorApi {
  constructor(private readonly schedule: FeeScheduleFile) {}

  isAvailable(country: string, provider: string, operation: FeeOperation): boolean {
    return this.#rule(country, provider, operation)?.enabled === true
  }

  quote(input: FeeQuoteInput): FeeQuote {
    if (!input.amount.isPositive()) {
      throw feeErrors.invalidAmount()
    }
    const rule = this.#rule(input.country, input.provider, input.operation)
    if (rule === undefined || !rule.enabled) {
      throw feeErrors.notConfigured()
    }

    const amount = input.amount.value
    const mesombFee = computeFee(toFormula(rule), amount)
    const appFee = this.#appFee(input.operation, amount)
    const totalFees = mesombFee + appFee
    if (input.operation === 'COLLECT' && totalFees >= amount) {
      throw feeErrors.exceedsAmount()
    }

    return {
      operation: input.operation,
      country: input.country,
      provider: input.provider,
      amount: input.amount,
      mesombFee: Money.of(mesombFee),
      appFee: Money.of(appFee),
      totalFees: Money.of(totalFees),
      walletDelta: Money.of(input.operation === 'COLLECT' ? amount - totalFees : -(amount + totalFees)),
    }
  }

  #rule(country: string, provider: string, operation: FeeOperation): FeeRuleFile | undefined {
    return this.schedule.mesomb[country]?.[provider]?.[operation]
  }

  #appFee(operation: FeeOperation, amount: bigint): bigint {
    const fee = this.schedule.appFee
    if (!fee.appliesTo.includes(operation)) {
      return 0n
    }
    return computeFee(
      {
        tiers: [{ upTo: null, fixed: 0n, bps: fee.bps }],
        min: BigInt(fee.min),
        max: fee.max === null ? null : BigInt(fee.max),
        rounding: fee.rounding,
      },
      amount,
    )
  }
}
