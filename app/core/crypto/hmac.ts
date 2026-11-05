import { createHmac } from 'node:crypto'

export function hmacSha256Hex(key: Buffer, message: string): string {
  return createHmac('sha256', key).update(message, 'utf8').digest('hex')
}

/**
 * Index aveugle : empreinte HMAC déterministe d'une valeur chiffrée, pour la rechercher ou garantir
 * son unicité sans la stocker en clair. Le `purpose` sépare les usages (une même valeur donne des
 * index différents selon la table). L'appelant normalise la valeur avant (ex. numéro au format E.164).
 */
export class BlindIndexer {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) {
      throw new Error('La clé d\'index aveugle doit faire 32 octets')
    }
  }

  index(purpose: string, normalizedValue: string): string {
    return hmacSha256Hex(this.key, `${purpose}:${normalizedValue}`)
  }
}
