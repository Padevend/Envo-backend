import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Money } from '../../app/core/money/money.js'
import { computeFee, percentOf } from '../../app/modules/payments/models/fee_math.js'
import { parseFeeSchedule } from '../../app/modules/payments/models/fee_schedule.js'
import { FeeCalculator } from '../../app/modules/payments/services/fee_calculator.js'
import { FeeError } from '../../app/modules/payments/exceptions/fee_errors.js'

function codeOf(operation: () => unknown): string | null {
  try {
    operation()
  } catch (error) {
    if (error instanceof FeeError) {
      return error.code
    }
    throw error
  }
  return null
}

const rule = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  verified: true,
  tiers: [
    { upTo: '5000', fixed: '100', bps: 0 },
    { upTo: null, fixed: '0', bps: 200 },
  ],
  min: '100',
  max: '5000',
  rounding: 'CEIL',
  ...overrides,
})

const scheduleWith = (appFee: Record<string, unknown> = {}) =>
  parseFeeSchedule({
    version: 1,
    currency: 'XAF',
    appFee: { bps: 50, min: '0', max: null, rounding: 'HALF_UP', appliesTo: ['COLLECT', 'PAYOUT'], ...appFee },
    mesomb: {
      CM: {
        MTN_MOMO: { COLLECT: rule(), PAYOUT: rule() },
        ORANGE_MONEY: { COLLECT: rule({ enabled: false }) },
      },
    },
  })

const calculator = new FeeCalculator(scheduleWith())
const quote = (operation: 'COLLECT' | 'PAYOUT', amount: number, provider = 'MTN_MOMO', country = 'CM') =>
  calculator.quote({ operation, country, provider, amount: Money.of(amount) })

describe('percentOf', () => {
  it('arrondit selon la règle choisie, en entiers exacts', () => {
    // 5001 * 200 bps = 100,02 → plafond 101, plancher 100, arrondi à la moitié supérieure 100
    expect(percentOf(5001n, 200, 'CEIL')).toBe(101n)
    expect(percentOf(5001n, 200, 'FLOOR')).toBe(100n)
    expect(percentOf(5001n, 200, 'HALF_UP')).toBe(100n)
    // 10100 * 50 bps = 50,5 → la moitié monte
    expect(percentOf(10_100n, 50, 'HALF_UP')).toBe(51n)
    expect(percentOf(10_100n, 50, 'FLOOR')).toBe(50n)
    // Pas d'arrondi quand le résultat est exact
    expect(percentOf(100_000n, 200, 'CEIL')).toBe(2_000n)
  })
})

describe('computeFee', () => {
  const formula = {
    tiers: [
      { upTo: 5_000n, fixed: 100n, bps: 0 },
      { upTo: null, fixed: 0n, bps: 200 },
    ],
    min: 100n,
    max: 5_000n,
    rounding: 'CEIL' as const,
  }

  it('la borne haute appartient au palier (incluse)', () => {
    expect(computeFee(formula, 5_000n)).toBe(100n)
    expect(computeFee(formula, 5_001n)).toBe(101n)
  })

  it('applique le plancher et le plafond', () => {
    expect(computeFee({ ...formula, tiers: [{ upTo: null, fixed: 0n, bps: 1 }] }, 1_000n)).toBe(100n)
    expect(computeFee(formula, 1_000_000n)).toBe(5_000n)
  })
})

describe('FeeCalculator', () => {
  it('recharge (COLLECT) : frais MeSomb + application déduits du crédit du wallet', () => {
    const result = quote('COLLECT', 1_000)
    expect(result.mesombFee.toString()).toBe('100')
    expect(result.appFee.toString()).toBe('5')
    expect(result.totalFees.toString()).toBe('105')
    expect(result.walletDelta.toString()).toBe('895')
  })

  it('envoi (PAYOUT) : les frais s\'ajoutent au débit du wallet', () => {
    const result = quote('PAYOUT', 100_000)
    expect(result.mesombFee.toString()).toBe('2000')
    expect(result.appFee.toString()).toBe('500')
    expect(result.walletDelta.toString()).toBe('-102500')
  })

  it('plafonne les frais MeSomb et arrondit les frais de l\'application à la moitié supérieure', () => {
    expect(quote('PAYOUT', 1_000_000).mesombFee.toString()).toBe('5000')
    const rounded = quote('PAYOUT', 10_100)
    expect(rounded.mesombFee.toString()).toBe('202')
    expect(rounded.appFee.toString()).toBe('51')
  })

  it('n\'applique pas les frais de l\'application aux opérations hors de appliesTo', () => {
    const onlyPayout = new FeeCalculator(scheduleWith({ appliesTo: ['PAYOUT'] }))
    const collect = onlyPayout.quote({ operation: 'COLLECT', country: 'CM', provider: 'MTN_MOMO', amount: Money.of(1_000) })
    expect(collect.appFee.isZero()).toBe(true)
  })

  it('refuse une opération sans barème, désactivée ou pour un pays inconnu', () => {
    expect(codeOf(() => quote('COLLECT', 1_000, 'ORANGE_MONEY'))).toBe('fee_not_configured')
    expect(codeOf(() => quote('PAYOUT', 1_000, 'ORANGE_MONEY'))).toBe('fee_not_configured')
    expect(codeOf(() => quote('PAYOUT', 1_000, 'MTN_MOMO', 'SN'))).toBe('fee_not_configured')
    expect(calculator.isAvailable('CM', 'MTN_MOMO', 'PAYOUT')).toBe(true)
    expect(calculator.isAvailable('CM', 'ORANGE_MONEY', 'COLLECT')).toBe(false)
    expect(calculator.isAvailable('SN', 'MTN_MOMO', 'COLLECT')).toBe(false)
  })

  it('refuse un montant nul ou négatif', () => {
    expect(codeOf(() => calculator.quote({ operation: 'PAYOUT', country: 'CM', provider: 'MTN_MOMO', amount: Money.ZERO }))).toBe('fee_invalid_amount')
    expect(codeOf(() => quote('PAYOUT', -5))).toBe('fee_invalid_amount')
  })

  it('refuse une recharge dont les frais atteignent le montant', () => {
    expect(codeOf(() => quote('COLLECT', 100))).toBe('fee_exceeds_amount')
    expect(codeOf(() => quote('COLLECT', 101))).toBe('fee_exceeds_amount')
    expect(quote('COLLECT', 102).walletDelta.toString()).toBe('1')
  })

  it('propriétés : frais positifs, bornés, et débit exact d\'un envoi', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2_000_000_000 }), (amount) => {
        const result = quote('PAYOUT', amount)
        expect(result.mesombFee.value).toBeGreaterThanOrEqual(100n)
        expect(result.mesombFee.value).toBeLessThanOrEqual(5_000n)
        expect(result.appFee.value).toBeGreaterThanOrEqual(0n)
        expect(result.totalFees.equals(result.mesombFee.add(result.appFee))).toBe(true)
        expect(result.walletDelta.equals(Money.of(amount).add(result.totalFees).negate())).toBe(true)
      }),
    )
  })
})
