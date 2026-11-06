import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'

/**
 * Adresse du client. `X-Forwarded-For` n'est lu que derrière un proxy de confiance (Caddy) :
 * sinon n'importe quel client pourrait choisir son adresse et contourner le rate limit.
 */
export function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded !== undefined && forwarded !== '') {
      return forwarded
    }
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    // Pas de socket (ex. app.request() en test).
    return 'unknown'
  }
}
