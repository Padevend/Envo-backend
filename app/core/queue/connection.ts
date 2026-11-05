import type { ConnectionOptions } from 'bullmq'

/**
 * Options de connexion Redis pour BullMQ, déduites de REDIS_URL. BullMQ ouvre ses propres connexions :
 * on lui passe des options (et non une instance ioredis) pour éviter tout conflit de versions.
 * `maxRetriesPerRequest: null` est exigé pour les workers (commandes bloquantes).
 */
export function redisConnectionOptions(url: string): ConnectionOptions {
  const parsed = new URL(url)
  const db = parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined
  return {
    host: parsed.hostname,
    port: parsed.port === '' ? 6379 : Number(parsed.port),
    ...(parsed.username === '' ? {} : { username: decodeURIComponent(parsed.username) }),
    ...(parsed.password === '' ? {} : { password: decodeURIComponent(parsed.password) }),
    ...(db !== undefined && Number.isInteger(db) ? { db } : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  }
}
