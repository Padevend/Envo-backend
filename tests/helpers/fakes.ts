import type { Transactional, Tx } from '../../app/core/database/unit_of_work.js'
import type { DeliveryRepository } from '../../app/core/events/delivery_repository.js'
import type {
  NewOutboxEvent,
  OutboxFailure,
  OutboxRecord,
  OutboxRepository,
} from '../../app/core/events/outbox_repository.js'
import type { Clock } from '../../app/core/support/clock.js'

export const fakeTx = {} as unknown as Tx

export class MutableClock implements Clock {
  constructor(public current: Date) {}

  now(): Date {
    return this.current
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms)
  }
}

export class FakeDeliveryRepository implements DeliveryRepository {
  #delivered = new Set<string>()

  async tryRecord(_tx: Tx, eventId: string, listener: string): Promise<boolean> {
    const key = `${eventId}|${listener}`
    if (this.#delivered.has(key)) {
      return false
    }
    this.#delivered.add(key)
    return true
  }

  snapshot(): Set<string> {
    return new Set(this.#delivered)
  }

  restore(snapshot: Set<string>): void {
    this.#delivered = snapshot
  }
}

/** Transaction simulée : en cas d'erreur, les livraisons enregistrées sont annulées (comme un rollback). */
export class FakeUow implements Transactional {
  constructor(private readonly deliveries: FakeDeliveryRepository) {}

  async run<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
    const snapshot = this.deliveries.snapshot()
    try {
      return await operation(fakeTx)
    } catch (error) {
      this.deliveries.restore(snapshot)
      throw error
    }
  }
}

export interface FakeRow {
  id: string
  type: string
  aggregateId: string | null
  payload: unknown
  occurredAt: Date
  attempts: number
  nextAttemptAt: Date
  status: 'PENDING' | 'PUBLISHED' | 'DEAD'
  lastError: string | null
}

export class FakeOutboxRepository implements OutboxRepository {
  readonly rows: FakeRow[] = []

  async append(_tx: Tx, event: NewOutboxEvent): Promise<void> {
    this.rows.push({
      id: event.id,
      type: event.type,
      aggregateId: event.aggregateId,
      payload: event.payload,
      occurredAt: event.occurredAt,
      attempts: 0,
      nextAttemptAt: event.occurredAt,
      status: 'PENDING',
      lastError: null,
    })
  }

  async claim(limit: number, now: Date, leaseMs: number): Promise<OutboxRecord[]> {
    const due = this.rows
      .filter((row) => row.status === 'PENDING' && row.nextAttemptAt <= now)
      .slice(0, limit)
    for (const row of due) {
      row.attempts++
      row.nextAttemptAt = new Date(now.getTime() + leaseMs)
    }
    return due.map((row) => ({
      id: row.id,
      type: row.type,
      aggregateId: row.aggregateId,
      payload: row.payload,
      occurredAt: row.occurredAt,
      attempts: row.attempts,
    }))
  }

  async markPublished(id: string): Promise<void> {
    const row = this.#get(id)
    row.status = 'PUBLISHED'
    row.lastError = null
  }

  async markFailed(id: string, failure: OutboxFailure): Promise<void> {
    const row = this.#get(id)
    row.status = failure.dead ? 'DEAD' : 'PENDING'
    row.nextAttemptAt = failure.nextAttemptAt
    row.lastError = failure.lastError
  }

  #get(id: string): FakeRow {
    const row = this.rows.find((candidate) => candidate.id === id)
    if (row === undefined) {
      throw new Error('ligne introuvable')
    }
    return row
  }
}
