import type { PrismaClient } from '@prisma/client'
import type { Tx } from '../database/unit_of_work.js'
import type {
  NewOutboxEvent,
  OutboxFailure,
  OutboxRecord,
  OutboxRepository,
} from './outbox_repository.js'

interface ClaimedRow {
  id: string
  type: string
  aggregate_id: string | null
  payload: unknown
  occurred_at: Date
  attempts: number
}

export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(tx: Tx, event: NewOutboxEvent): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        id: event.id,
        type: event.type,
        aggregateId: event.aggregateId,
        payload: event.payload,
        occurredAt: event.occurredAt,
        nextAttemptAt: event.occurredAt,
      },
    })
  }

  /**
   * Bail ("lease") : le lot est réservé en repoussant `next_attempt_at`. Si le relais meurt en cours
   * de route, les événements redeviennent échus après `leaseMs` (livraison au moins une fois).
   * SKIP LOCKED : plusieurs relais peuvent tourner en parallèle sans se marcher dessus.
   */
  async claim(limit: number, now: Date, leaseMs: number): Promise<OutboxRecord[]> {
    const leaseUntil = new Date(now.getTime() + leaseMs)
    const rows = await this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE "outbox_events"
      SET "next_attempt_at" = ${leaseUntil}, "attempts" = "attempts" + 1
      WHERE "id" IN (
        SELECT "id" FROM "outbox_events"
        WHERE "status" = 'PENDING'::"OutboxStatus" AND "next_attempt_at" <= ${now}
        ORDER BY "occurred_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "type", "aggregate_id", "payload", "occurred_at", "attempts"`
    return rows
      .map((row) => ({
        id: row.id,
        type: row.type,
        aggregateId: row.aggregate_id,
        payload: row.payload,
        occurredAt: row.occurred_at,
        attempts: row.attempts,
      }))
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
  }

  async markPublished(id: string, now: Date): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: now, lastError: null },
    })
  }

  async markFailed(id: string, failure: OutboxFailure): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: failure.dead ? 'DEAD' : 'PENDING',
        nextAttemptAt: failure.nextAttemptAt,
        lastError: failure.lastError,
      },
    })
  }
}
