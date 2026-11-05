import { cors } from 'hono/cors'

/** CORS strict : seules les origines listées sont autorisées (liste vide = aucune). */
export function corsMiddleware(allowedOrigins: readonly string[]) {
  return cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id', 'Idempotency-Replayed'],
    maxAge: 600,
  })
}
