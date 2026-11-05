export interface IdempotencyRef {
  /** Identifiant de l'utilisateur (la clé d'idempotence est propre à chaque utilisateur). */
  scope: string
  key: string
  /** "POST /v1/payouts" */
  endpoint: string
}

export interface IdempotencyBeginInput extends IdempotencyRef {
  requestHash: string
  now: Date
  ttlMs: number
  /** Au-delà, un verrou jamais libéré (processus mort) peut être repris. */
  lockTimeoutMs: number
}

export interface StoredResponse {
  status: number
  contentType: string
  body: string
}

export type IdempotencyBeginResult =
  | { state: 'acquired' }
  | { state: 'replay'; response: StoredResponse }
  | { state: 'in_progress' }
  | { state: 'mismatch' }

export interface IdempotencyStore {
  /** Verrouille la clé de façon atomique, ou indique ce qu'il faut faire (rejouer, attendre, rejeter). */
  begin(input: IdempotencyBeginInput): Promise<IdempotencyBeginResult>
  complete(ref: IdempotencyRef, response: StoredResponse, now: Date): Promise<void>
  /** Libère un verrou non terminé (erreur serveur) pour autoriser une nouvelle tentative. */
  release(ref: IdempotencyRef): Promise<void>
  purgeExpired(now: Date): Promise<number>
}
