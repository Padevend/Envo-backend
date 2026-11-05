import type { Prisma } from '@prisma/client'
import type { Tx } from '../database/unit_of_work.js'

export interface NewOutboxEvent {
  id: string
  type: string
  aggregateId: string | null
  payload: Prisma.InputJsonObject
  occurredAt: Date
}

export interface OutboxRecord {
  id: string
  type: string
  aggregateId: string | null
  payload: unknown
  occurredAt: Date
  /** Nombre de livraisons tentées, y compris celle en cours. */
  attempts: number
}

export interface OutboxFailure {
  nextAttemptAt: Date
  lastError: string
  dead: boolean
}

export interface OutboxRepository {
  /** Écrit l'événement dans la transaction de l'appelant (même commit que le ledger). */
  append(tx: Tx, event: NewOutboxEvent): Promise<void>
  /** Réserve un lot d'événements échus avec un bail ; incrémente `attempts`. */
  claim(limit: number, now: Date, leaseMs: number): Promise<OutboxRecord[]>
  markPublished(id: string, now: Date): Promise<void>
  markFailed(id: string, failure: OutboxFailure): Promise<void>
}
