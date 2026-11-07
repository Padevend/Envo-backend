import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Money } from '../../app/core/money/money.js'

const bound = 10n ** 12n

describe('Money : propriétés', () => {
  it('aller-retour chaîne ↔ montant pour tout entier', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 30n), max: 10n ** 30n }), (value) => {
        expect(Money.parse(Money.of(value).toString()).equals(Money.of(value))).toBe(true)
      }),
    )
  })

  it('l\'addition est commutative, associative et sa soustraction l\'inverse', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -bound, max: bound }),
        fc.bigInt({ min: -bound, max: bound }),
        fc.bigInt({ min: -bound, max: bound }),
        (a, b, c) => {
          const [x, y, z] = [Money.of(a), Money.of(b), Money.of(c)]
          expect(x.add(y).equals(y.add(x))).toBe(true)
          expect(x.add(y).add(z).equals(x.add(y.add(z)))).toBe(true)
          expect(x.add(y).subtract(y).equals(x)).toBe(true)
        },
      ),
    )
  })

  it('allocate : la somme des parts est exactement le montant, quel que soit le reste', () => {
    const weightsArb = fc
      .array(fc.bigInt({ min: 0n, max: 1_000n }), { minLength: 1, maxLength: 8 })
      .filter((weights) => weights.some((weight) => weight > 0n))
    fc.assert(
      fc.property(
        fc.bigInt({ min: -bound, max: bound }),
        weightsArb,
        fc.nat({ max: 7 }),
        (amount, weights, rawIndex) => {
          const remainderIndex = rawIndex % weights.length
          const parts = Money.of(amount).allocate(weights, remainderIndex)

          expect(parts).toHaveLength(weights.length)
          expect(Money.sum(parts).equals(Money.of(amount))).toBe(true)
          for (const part of parts) {
            // Aucune part ne change de signe par rapport au montant.
            expect(amount >= 0n ? part.value >= 0n : part.value <= 0n).toBe(true)
          }
          // Un poids nul ne reçoit rien, sauf la part qui absorbe le reste.
          weights.forEach((weight, index) => {
            if (weight === 0n && index !== remainderIndex) {
              expect(parts[index]?.isZero()).toBe(true)
            }
          })
        },
      ),
    )
  })
})
