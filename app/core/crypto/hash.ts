import { createHash, timingSafeEqual } from 'node:crypto'

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

/** Comparaison à temps constant, y compris quand les longueurs diffèrent (on compare des empreintes). */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right)
}
