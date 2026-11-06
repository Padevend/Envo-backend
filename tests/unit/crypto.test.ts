import { describe, expect, it } from 'vitest'
import { AesGcmCipher, CryptoError } from '../../app/core/crypto/aes_gcm.js'
import { sha256Hex, timingSafeEqualStrings } from '../../app/core/crypto/hash.js'
import { BlindIndexer } from '../../app/core/crypto/hmac.js'
import { randomNumericCode, randomToken } from '../../app/core/crypto/random.js'

const key = (fill: number): Buffer => Buffer.alloc(32, fill)
const cipherV1 = (): AesGcmCipher => new AesGcmCipher({ activeVersion: 1, keys: new Map([[1, key(1)]]) })

describe('AesGcmCipher', () => {
  it('chiffre puis déchiffre', () => {
    const cipher = cipherV1()
    const encrypted = cipher.encrypt('+237612345678')
    expect(encrypted).not.toContain('237612345678')
    expect(encrypted.startsWith('v1.')).toBe(true)
    expect(cipher.decrypt(encrypted)).toBe('+237612345678')
  })

  it('produit un résultat différent à chaque chiffrement (IV aléatoire)', () => {
    const cipher = cipherV1()
    expect(cipher.encrypt('valeur')).not.toBe(cipher.encrypt('valeur'))
  })

  it('lie le message à son contexte (AAD)', () => {
    const cipher = cipherV1()
    const encrypted = cipher.encrypt('valeur', 'user-1')
    expect(cipher.decrypt(encrypted, 'user-1')).toBe('valeur')
    expect(() => cipher.decrypt(encrypted, 'user-2')).toThrow(CryptoError)
    expect(() => cipher.decrypt(encrypted)).toThrow(CryptoError)
  })

  it('détecte toute altération', () => {
    const cipher = cipherV1()
    const [version = '', iv = '', ciphertext = '', tag = ''] = cipher.encrypt('valeur').split('.')
    const flipped = ciphertext.endsWith('A') ? `${ciphertext.slice(0, -1)}B` : `${ciphertext.slice(0, -1)}A`
    expect(() => cipher.decrypt([version, iv, flipped, tag].join('.'))).toThrow(CryptoError)
  })

  it('ne déchiffre pas avec une autre clé', () => {
    const other = new AesGcmCipher({ activeVersion: 1, keys: new Map([[1, key(2)]]) })
    expect(() => other.decrypt(cipherV1().encrypt('valeur'))).toThrow(CryptoError)
  })

  it('rejette les formats invalides avec un message uniforme', () => {
    const cipher = cipherV1()
    for (const garbage of ['', 'abc', 'v1.a.b', 'v9.a.b.c', 'x1.a.b.c', 'v1.a.b.c.d']) {
      expect(() => cipher.decrypt(garbage)).toThrow('Déchiffrement impossible')
    }
  })

  it('gère la rotation : l\'ancienne version reste lisible, la nouvelle devient active', () => {
    const oldMessage = cipherV1().encrypt('valeur')
    const rotated = new AesGcmCipher({
      activeVersion: 2,
      keys: new Map([
        [1, key(1)],
        [2, key(2)],
      ]),
    })
    expect(rotated.decrypt(oldMessage)).toBe('valeur')
    expect(rotated.needsRotation(oldMessage)).toBe(true)
    const fresh = rotated.encrypt('valeur')
    expect(fresh.startsWith('v2.')).toBe(true)
    expect(rotated.needsRotation(fresh)).toBe(false)
  })

  it('refuse un trousseau invalide', () => {
    expect(() => new AesGcmCipher({ activeVersion: 1, keys: new Map([[1, Buffer.alloc(16)]]) })).toThrow(CryptoError)
    expect(() => new AesGcmCipher({ activeVersion: 2, keys: new Map([[1, key(1)]]) })).toThrow(CryptoError)
  })
})

describe('BlindIndexer', () => {
  const indexer = new BlindIndexer(key(7))

  it('est déterministe et hexadécimal sur 64 caractères', () => {
    expect(indexer.index('payee_phone', '+237612345678')).toBe(indexer.index('payee_phone', '+237612345678'))
    expect(indexer.index('payee_phone', '+237612345678')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('sépare les usages, les valeurs et les clés', () => {
    const base = indexer.index('payee_phone', '+237612345678')
    expect(indexer.index('user_phone', '+237612345678')).not.toBe(base)
    expect(indexer.index('payee_phone', '+237699999999')).not.toBe(base)
    expect(new BlindIndexer(key(8)).index('payee_phone', '+237612345678')).not.toBe(base)
  })

  it('refuse une clé de mauvaise taille', () => {
    expect(() => new BlindIndexer(Buffer.alloc(8))).toThrow()
  })
})

describe('hash', () => {
  it('calcule SHA-256 (vecteur de référence)', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('compare à temps constant, longueurs différentes comprises', () => {
    expect(timingSafeEqualStrings('abc', 'abc')).toBe(true)
    expect(timingSafeEqualStrings('abc', 'abd')).toBe(false)
    expect(timingSafeEqualStrings('abc', 'abcd')).toBe(false)
  })
})

describe('random', () => {
  it('génère des codes numériques de la bonne longueur', () => {
    for (let i = 0; i < 200; i++) {
      expect(randomNumericCode(6)).toMatch(/^\d{6}$/)
    }
  })

  it('refuse un nombre de chiffres invalide', () => {
    expect(() => randomNumericCode(0)).toThrow(RangeError)
    expect(() => randomNumericCode(13)).toThrow(RangeError)
  })

  it('génère des jetons base64url distincts', () => {
    const token = randomToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(token)
    expect(() => randomToken(8)).toThrow(RangeError)
  })
})
