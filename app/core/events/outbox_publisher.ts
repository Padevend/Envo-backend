import type { Prisma } from '@prisma/client'
import type { Tx } from '../database/unit_of_work.js'
import type { Clock } from '../support/clock.js'
import type { IdGenerator } from '../support/ids.js'
import type { DomainEventMap, DomainEventType } from './domain_event.js'
import type { OutboxRepository } from './outbox_repository.js'

/**
 * Point d'entrée des modules pour émettre un événement : il est écrit dans la transaction `tx` de
 * l'appelant, donc il existe si et seulement si l'opération métier (ex. l'écriture du ledger) est validée.
 */
export class OutboxPublisher {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async publish<K extends DomainEventType>(
    tx: Tx,
    type: K,
    payload: DomainEventMap[K],
    aggregateId?: string,
  ): Promise<string> {
    const id = this.ids.uuid()
    await this.outbox.append(tx, {
      id,
      type,
      aggregateId: aggregateId ?? null,
      // Les charges utiles de DomainEventMap sont du JSON pur par convention (voir domain_event.ts).
      payload: payload as unknown as Prisma.InputJsonObject,
      occurredAt: this.clock.now(),
    })
    return id
  }
}
