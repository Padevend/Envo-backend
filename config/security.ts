import { z } from 'zod'

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

/** Décode une clé de 32 octets en base64 ; `undefined` si le format est invalide. */
function decodeKey(raw: string): Buffer | undefined {
  if (!BASE64.test(raw)) {
    return undefined
  }
  const decoded = Buffer.from(raw, 'base64')
  return decoded.length === 32 ? decoded : undefined
}

const KEY_FORMAT_MESSAGE = 'doit être une clé de 32 octets encodée en base64'

export const securityEnvSchema = z.object({
  /** Trousseau versionné : "1:<base64>,2:<base64>". Les anciennes versions servent à déchiffrer après rotation. */
  ENCRYPTION_KEYS: z
    .string()
    .min(1)
    .transform((raw, ctx) => {
      const keys = new Map<number, Buffer>()
      for (const entry of raw.split(',')) {
        const [versionRaw, keyRaw, ...extra] = entry.trim().split(':')
        const version = Number(versionRaw)
        const decoded = keyRaw === undefined ? undefined : decodeKey(keyRaw)
        if (
          extra.length > 0 ||
          !Number.isInteger(version) ||
          version < 1 ||
          decoded === undefined ||
          keys.has(version)
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'format attendu : <version>:<clé base64 de 32 octets>, versions uniques, séparées par des virgules',
          })
          return z.NEVER
        }
        keys.set(version, decoded)
      }
      return keys
    }),
  ENCRYPTION_ACTIVE_KEY_VERSION: z.coerce.number().int().positive(),
  /** Clé HMAC des index aveugles (recherche sur des champs chiffrés). Distincte des clés de chiffrement. */
  BLIND_INDEX_KEY: z
    .string()
    .min(1)
    .transform((raw, ctx) => {
      const decoded = decodeKey(raw)
      if (decoded === undefined) {
        ctx.addIssue({ code: 'custom', message: KEY_FORMAT_MESSAGE })
        return z.NEVER
      }
      return decoded
    }),
  /** true derrière Caddy : l'adresse client est lue dans X-Forwarded-For. Jamais true si l'API est joignable directement. */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

export function securityConfig(env: z.infer<typeof securityEnvSchema>) {
  return {
    encryptionKeys: env.ENCRYPTION_KEYS,
    activeKeyVersion: env.ENCRYPTION_ACTIVE_KEY_VERSION,
    blindIndexKey: env.BLIND_INDEX_KEY,
    trustProxy: env.TRUST_PROXY,
  } as const
}
