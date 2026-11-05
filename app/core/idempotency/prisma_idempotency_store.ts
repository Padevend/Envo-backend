import type { Prisma, PrismaClient } from '@prisma/client'
import type {
  IdempotencyBeginInput,
  IdempotencyBeginResult,
  IdempotencyRef,
  IdempotencyStore,
  StoredResponse,
} from './idempotency_store.js'

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
}

function parseStoredResponse(
  status: number | null,
  body: Prisma.JsonValue | null,
): StoredResponse | undefined {
  if (status === null || typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined
  }
  const { contentType, body: text } = body
  if (typeof contentType !== 'string' || typeof text !== 'string') {
    return undefined
  }
  return { status, contentType, body: text }
}

/** Verrou fondé sur la contrainte d'unicité (userId, key, endpoint) : atomique même avec plusieurs API. */
export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly prisma: PrismaClient) {}

  async begin(input: IdempotencyBeginInput): Promise<IdempotencyBeginResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (await this.tryInsert(input)) {
        return { state: 'acquired' }
      }
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          userId_key_endpoint: { userId: input.scope, key: input.key, endpoint: input.endpoint },
        },
      })
      if (existing === null) {
        continue // purgée entre-temps : on retente l'insertion
      }
      if (existing.requestHash !== input.requestHash) {
        return { state: 'mismatch' }
      }
      const stored = parseStoredResponse(existing.responseStatus, existing.responseBody)
      if (existing.completedAt !== null && stored !== undefined) {
        return { state: 'replay', response: stored }
      }
      return this.takeOverIfStale(existing, input)
    }
    return { state: 'in_progress' }
  }

  async complete(ref: IdempotencyRef, response: StoredResponse, now: Date): Promise<void> {
    await this.prisma.idempotencyKey.updateMany({
      where: { userId: ref.scope, key: ref.key, endpoint: ref.endpoint },
      data: {
        responseStatus: response.status,
        responseBody: { contentType: response.contentType, body: response.body },
        completedAt: now,
        lockedAt: null,
      },
    })
  }

  async release(ref: IdempotencyRef): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({
      where: { userId: ref.scope, key: ref.key, endpoint: ref.endpoint, completedAt: null },
    })
  }

  async purgeExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: now } },
    })
    return count
  }

  private async tryInsert(input: IdempotencyBeginInput): Promise<boolean> {
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          userId: input.scope,
          key: input.key,
          endpoint: input.endpoint,
          requestHash: input.requestHash,
          lockedAt: input.now,
          expiresAt: new Date(input.now.getTime() + input.ttlMs),
        },
      })
      return true
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false
      }
      throw error
    }
  }

  private async takeOverIfStale(
    existing: { id: string; lockedAt: Date | null },
    input: IdempotencyBeginInput,
  ): Promise<IdempotencyBeginResult> {
    const { lockedAt } = existing
    if (lockedAt !== null && input.now.getTime() - lockedAt.getTime() < input.lockTimeoutMs) {
      return { state: 'in_progress' }
    }
    // Reprise atomique : une seule requête gagne si le verrou n'a pas bougé entre-temps.
    const { count } = await this.prisma.idempotencyKey.updateMany({
      where: { id: existing.id, lockedAt, completedAt: null },
      data: { lockedAt: input.now },
    })
    return count === 1 ? { state: 'acquired' } : { state: 'in_progress' }
  }
}
