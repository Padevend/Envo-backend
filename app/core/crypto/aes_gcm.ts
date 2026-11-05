import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export class CryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CryptoError'
  }
}

export interface KeyRing {
  activeVersion: number
  keys: ReadonlyMap<number, Buffer>
}

const IV_BYTES = 12

/**
 * AES-256-GCM avec clés versionnées (rotation sans perte : on chiffre avec la clé active,
 * on déchiffre avec la version inscrite dans le message).
 * Format : `v<version>.<iv>.<chiffré>.<tag>` (base64url). Le paramètre `aad` lie le message à un
 * contexte (ex. l'identifiant de l'utilisateur) : copié ailleurs, il ne se déchiffre plus.
 */
export class AesGcmCipher {
  constructor(private readonly ring: KeyRing) {
    for (const key of ring.keys.values()) {
      if (key.length !== 32) {
        throw new CryptoError('Chaque clé de chiffrement doit faire 32 octets')
      }
    }
    if (!ring.keys.has(ring.activeVersion)) {
      throw new CryptoError('La version de clé active est absente du trousseau')
    }
  }

  encrypt(plaintext: string, aad?: string): string {
    const version = this.ring.activeVersion
    const key = this.ring.keys.get(version)
    if (key === undefined) {
      throw new CryptoError('Clé active introuvable')
    }
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    if (aad !== undefined) {
      cipher.setAAD(Buffer.from(aad, 'utf8'))
    }
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return [
      `v${version}`,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join('.')
  }

  decrypt(payload: string, aad?: string): string {
    const [versionPart, ivPart, ciphertextPart, tagPart, ...extra] = payload.split('.')
    const version = parseVersion(versionPart)
    const key = version === undefined ? undefined : this.ring.keys.get(version)
    if (
      key === undefined ||
      ivPart === undefined ||
      ciphertextPart === undefined ||
      tagPart === undefined ||
      extra.length > 0
    ) {
      throw new CryptoError('Déchiffrement impossible')
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'))
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
      if (aad !== undefined) {
        decipher.setAAD(Buffer.from(aad, 'utf8'))
      }
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextPart, 'base64url')),
        decipher.final(),
      ])
      return plaintext.toString('utf8')
    } catch {
      // Message volontairement uniforme : ne rien révéler (clé, tag, format).
      throw new CryptoError('Déchiffrement impossible')
    }
  }

  /** Vrai si le message a été chiffré avec une version de clé autre que la version active (à réécrire). */
  needsRotation(payload: string): boolean {
    return parseVersion(payload.split('.')[0]) !== this.ring.activeVersion
  }
}

function parseVersion(part: string | undefined): number | undefined {
  const match = part === undefined ? null : /^v([1-9]\d*)$/.exec(part)
  return match?.[1] === undefined ? undefined : Number(match[1])
}
