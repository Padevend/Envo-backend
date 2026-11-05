export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}

/** Entier décimal canonique : pas de zéros en tête, pas de "+", pas de "-0", pas de décimales. */
const CANONICAL_INTEGER = /^(0|-?[1-9]\d*)$/

/**
 * Montant en XAF (entier, pas de centimes), stocké en `bigint` : jamais de flottant pour l'argent.
 * Immuable. Sérialisé en chaîne décimale (JSON) pour ne perdre aucune précision.
 */
export class Money {
  static readonly ZERO = new Money(0n)

  private constructor(readonly value: bigint) {}

  static of(amount: bigint | number): Money {
    if (typeof amount === 'number') {
      if (!Number.isSafeInteger(amount)) {
        throw new MoneyError('Le montant doit être un entier sûr')
      }
      return new Money(BigInt(amount))
    }
    return new Money(amount)
  }

  /** Lit un montant depuis une chaîne (entrée HTTP, JSON). Strict : le message d'erreur ne reprend pas l'entrée. */
  static parse(raw: string): Money {
    if (!CANONICAL_INTEGER.test(raw)) {
      throw new MoneyError('Montant invalide : entier décimal attendu')
    }
    return new Money(BigInt(raw))
  }

  static sum(values: readonly Money[]): Money {
    return values.reduce((total, current) => total.add(current), Money.ZERO)
  }

  add(other: Money): Money {
    return new Money(this.value + other.value)
  }

  subtract(other: Money): Money {
    return new Money(this.value - other.value)
  }

  negate(): Money {
    return new Money(-this.value)
  }

  multiply(factor: bigint): Money {
    return new Money(this.value * factor)
  }

  isZero(): boolean {
    return this.value === 0n
  }

  isPositive(): boolean {
    return this.value > 0n
  }

  isNegative(): boolean {
    return this.value < 0n
  }

  equals(other: Money): boolean {
    return this.value === other.value
  }

  compare(other: Money): -1 | 0 | 1 {
    if (this.value === other.value) {
      return 0
    }
    return this.value < other.value ? -1 : 1
  }

  /**
   * Répartit le montant selon des poids entiers. Chaque part est arrondie vers zéro ;
   * le reste (toujours >= 0 en valeur absolue) est ajouté à la part `remainderIndex`.
   * La somme des parts est exactement égale au montant.
   */
  allocate(weights: readonly bigint[], remainderIndex = 0): Money[] {
    if (weights.length === 0) {
      throw new MoneyError('Au moins un poids est requis')
    }
    if (!Number.isInteger(remainderIndex) || remainderIndex < 0 || remainderIndex >= weights.length) {
      throw new MoneyError('Index du reste hors limites')
    }
    let totalWeight = 0n
    for (const weight of weights) {
      if (weight < 0n) {
        throw new MoneyError('Les poids doivent être positifs ou nuls')
      }
      totalWeight += weight
    }
    if (totalWeight === 0n) {
      throw new MoneyError('La somme des poids doit être strictement positive')
    }

    const negative = this.value < 0n
    const magnitude = negative ? -this.value : this.value
    const shares = weights.map((weight) => (magnitude * weight) / totalWeight)
    const allocated = shares.reduce((sum, share) => sum + share, 0n)
    shares[remainderIndex] = (shares[remainderIndex] ?? 0n) + (magnitude - allocated)
    return shares.map((share) => new Money(negative ? -share : share))
  }

  toString(): string {
    return this.value.toString()
  }

  toJSON(): string {
    return this.value.toString()
  }
}
