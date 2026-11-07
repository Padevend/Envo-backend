export type FeeRounding = 'CEIL' | 'FLOOR' | 'HALF_UP'

export interface FeeTier {
  /** Borne haute incluse du palier ; `null` = palier ouvert (dernier). */
  upTo: bigint | null
  fixed: bigint
  /** Points de base : 100 bps = 1 %. */
  bps: number
}

export interface FeeFormula {
  tiers: readonly FeeTier[]
  min: bigint
  max: bigint | null
  rounding: FeeRounding
}

/** Pourcentage en points de base, arrondi selon `rounding` (calcul exact en bigint, aucun flottant). */
export function percentOf(amount: bigint, bps: number, rounding: FeeRounding): bigint {
  const numerator = amount * BigInt(bps)
  const floor = numerator / 10_000n
  const remainder = numerator % 10_000n
  switch (rounding) {
    case 'FLOOR':
      return floor
    case 'CEIL':
      return remainder > 0n ? floor + 1n : floor
    case 'HALF_UP':
      return remainder * 2n >= 10_000n ? floor + 1n : floor
  }
}

/** Frais = (fixe + pourcentage) du palier qui contient le montant, borné par [min, max]. */
export function computeFee(formula: FeeFormula, amount: bigint): bigint {
  const tier = formula.tiers.find((candidate) => candidate.upTo === null || amount <= candidate.upTo)
  if (tier === undefined) {
    throw new Error('Aucun palier applicable : le dernier palier doit être ouvert')
  }
  let fee = tier.fixed + percentOf(amount, tier.bps, formula.rounding)
  if (fee < formula.min) {
    fee = formula.min
  }
  if (formula.max !== null && fee > formula.max) {
    fee = formula.max
  }
  return fee
}
