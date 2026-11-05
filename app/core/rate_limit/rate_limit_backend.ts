export interface RateLimitDecision {
  allowed: boolean
  remaining: number
  /** Durée avant qu'une place se libère (0 si autorisé). */
  retryAfterMs: number
}

/** Fenêtre glissante : au plus `limit` requêtes sur les `windowMs` dernières millisecondes. */
export interface RateLimitBackend {
  hit(key: string, nowMs: number, windowMs: number, limit: number): Promise<RateLimitDecision>
}
