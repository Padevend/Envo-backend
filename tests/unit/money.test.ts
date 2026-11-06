import { describe, expect, it } from 'vitest'
import { Money, MoneyError } from '../../app/core/money/money.js'

describe('Money.parse', () => {
  it.each(['0', '1000', '-12', '9007199254740993'])('accepte %s', (raw) => {
    expect(Money.parse(raw).toString()).toBe(raw)
  })

  it.each(['', '01', '+5', '1.5', '1e3', ' 5', '5 ', '-0', 'abc', '1,000'])(
    'refuse %j',
    (raw) => {
      expect(() => Money.parse(raw)).toThrow(MoneyError)
    },
  )

  it('ne reprend pas l\'entrée dans le message d\'erreur', () => {
    expect(() => Money.parse('secret-value')).toThrow(/^(?!.*secret-value)/)
  })
})

describe('Money', () => {
  it('conserve la précision au-delà de 2^53', () => {
    const total = Money.parse('9007199254740993').add(Money.of(1))
    expect(total.toString()).toBe('9007199254740994')
  })

  it('refuse un nombre non entier ou non sûr', () => {
    expect(() => Money.of(1.5)).toThrow(MoneyError)
    expect(() => Money.of(Number.MAX_SAFE_INTEGER + 1)).toThrow(MoneyError)
  })

  it('additionne, soustrait, niègue, multiplie', () => {
    expect(Money.of(1500).add(Money.of(500)).toString()).toBe('2000')
    expect(Money.of(500).subtract(Money.of(800)).toString()).toBe('-300')
    expect(Money.of(42).negate().toString()).toBe('-42')
    expect(Money.of(250).multiply(4n).toString()).toBe('1000')
    expect(Money.sum([Money.of(1), Money.of(2), Money.of(3)]).toString()).toBe('6')
  })

  it('compare et teste le signe', () => {
    expect(Money.of(1).compare(Money.of(2))).toBe(-1)
    expect(Money.of(2).compare(Money.of(2))).toBe(0)
    expect(Money.of(3).compare(Money.of(2))).toBe(1)
    expect(Money.ZERO.isZero()).toBe(true)
    expect(Money.of(-1).isNegative()).toBe(true)
    expect(Money.of(1).isPositive()).toBe(true)
    expect(Money.of(5).equals(Money.parse('5'))).toBe(true)
  })

  it('se sérialise en chaîne JSON', () => {
    expect(JSON.stringify({ amount: Money.of(1500) })).toBe('{"amount":"1500"}')
  })
})

describe('Money.allocate', () => {
  const toStrings = (parts: Money[]): string[] => parts.map((part) => part.toString())

  it('répartit équitablement et donne le reste à la part désignée', () => {
    expect(toStrings(Money.of(100).allocate([1n, 1n, 1n]))).toEqual(['34', '33', '33'])
    expect(toStrings(Money.of(100).allocate([1n, 1n, 1n], 2))).toEqual(['33', '33', '34'])
  })

  it('respecte les poids', () => {
    expect(toStrings(Money.of(1001).allocate([50n, 30n, 20n]))).toEqual(['501', '300', '200'])
  })

  it('ne perd ni ne crée aucun franc, y compris pour un montant négatif', () => {
    for (const amount of [0, 1, 7, 99, 100, 1_000_003, -1, -100, -1_000_003]) {
      const parts = Money.of(amount).allocate([3n, 5n, 0n, 11n], 1)
      expect(Money.sum(parts).equals(Money.of(amount))).toBe(true)
    }
    expect(toStrings(Money.of(-100).allocate([1n, 1n, 1n]))).toEqual(['-34', '-33', '-33'])
  })

  it('refuse des paramètres invalides', () => {
    expect(() => Money.of(10).allocate([])).toThrow(MoneyError)
    expect(() => Money.of(10).allocate([1n, -1n])).toThrow(MoneyError)
    expect(() => Money.of(10).allocate([0n, 0n])).toThrow(MoneyError)
    expect(() => Money.of(10).allocate([1n, 1n], 2)).toThrow(MoneyError)
  })
})
