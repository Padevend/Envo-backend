import { randomBytes, randomInt } from 'node:crypto'

/** Code numérique (OTP) tiré d'un générateur cryptographique, avec zéros en tête conservés. */
export function randomNumericCode(digits: number): string {
  if (!Number.isInteger(digits) || digits < 1 || digits > 12) {
    throw new RangeError('Le nombre de chiffres doit être compris entre 1 et 12')
  }
  return randomInt(0, 10 ** digits).toString().padStart(digits, '0')
}

/** Jeton opaque (base64url) tiré d'un générateur cryptographique. */
export function randomToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new RangeError('Un jeton doit faire au moins 16 octets')
  }
  return randomBytes(byteLength).toString('base64url')
}
