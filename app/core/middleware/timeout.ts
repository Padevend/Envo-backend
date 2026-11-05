import { timeout } from 'hono/timeout'

/** Dépassement → 504 (HTTPException de Hono), converti en problem+json par l'error handler. */
export function timeoutMiddleware(durationMs: number) {
  return timeout(durationMs)
}
