import type {
  IdempotencyBeginInput,
  IdempotencyBeginResult,
  IdempotencyRef,
  IdempotencyStore,
  StoredResponse,
} from '../../app/core/idempotency/idempotency_store.js'

interface Entry {
  requestHash: string
  lockedAt: Date | null
  response: StoredResponse | null
  expiresAt: Date
}

/** Mêmes règles que le store Prisma, en mémoire : pour tester le middleware sans base. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly entries = new Map<string, Entry>()

  async begin(input: IdempotencyBeginInput): Promise<IdempotencyBeginResult> {
    const id = this.#id(input)
    const existing = this.entries.get(id)
    if (existing === undefined) {
      this.entries.set(id, {
        requestHash: input.requestHash,
        lockedAt: input.now,
        response: null,
        expiresAt: new Date(input.now.getTime() + input.ttlMs),
      })
      return { state: 'acquired' }
    }
    if (existing.requestHash !== input.requestHash) {
      return { state: 'mismatch' }
    }
    if (existing.response !== null) {
      return { state: 'replay', response: existing.response }
    }
    if (
      existing.lockedAt !== null &&
      input.now.getTime() - existing.lockedAt.getTime() < input.lockTimeoutMs
    ) {
      return { state: 'in_progress' }
    }
    existing.lockedAt = input.now
    return { state: 'acquired' }
  }

  async complete(ref: IdempotencyRef, response: StoredResponse): Promise<void> {
    const entry = this.entries.get(this.#id(ref))
    if (entry !== undefined) {
      entry.response = response
      entry.lockedAt = null
    }
  }

  async release(ref: IdempotencyRef): Promise<void> {
    const id = this.#id(ref)
    if (this.entries.get(id)?.response === null) {
      this.entries.delete(id)
    }
  }

  async purgeExpired(now: Date): Promise<number> {
    let purged = 0
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt < now) {
        this.entries.delete(id)
        purged++
      }
    }
    return purged
  }

  #id(ref: IdempotencyRef): string {
    return `${ref.scope}|${ref.key}|${ref.endpoint}`
  }
}
