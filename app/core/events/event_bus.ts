import type { Transactional, Tx } from '../database/unit_of_work.js'
import type { DeliveryRepository } from './delivery_repository.js'
import type { DomainEvent, DomainEventType } from './domain_event.js'

/** Événement tel que relu depuis l'outbox (charge utile non typée). */
export interface StoredEvent {
  id: string
  type: string
  aggregateId: string | null
  payload: unknown
  occurredAt: Date
}

export interface ListenerContext {
  /** Transaction dans laquelle le listener doit écrire ses effets : annulés en bloc si le listener échoue. */
  tx: Tx
}

export type EventHandler<K extends DomainEventType> = (
  event: DomainEvent<K>,
  context: ListenerContext,
) => Promise<void>

interface ListenerEntry {
  name: string
  handle: (event: StoredEvent, context: ListenerContext) => Promise<void>
}

/**
 * Bus d'événements in-process alimenté par l'outbox. Livraison "au moins une fois" côté relais,
 * rendue "une seule fois" par listener grâce à la table de livraisons (même transaction que l'effet).
 */
export class EventBus {
  readonly #listeners = new Map<string, ListenerEntry[]>()

  /** `name` doit être unique et stable (ex. "wallets.apply_rules") : il identifie la livraison. */
  subscribe<K extends DomainEventType>(type: K, name: string, handler: EventHandler<K>): void {
    const entries = this.#listeners.get(type) ?? []
    if (entries.some((entry) => entry.name === name)) {
      throw new Error(`Listener déjà enregistré : ${name} (${type})`)
    }
    entries.push({
      name,
      // Le type de l'événement relu est garanti par la clé `type` de l'abonnement.
      handle: (event, context) => handler(event as unknown as DomainEvent<K>, context),
    })
    this.#listeners.set(type, entries)
  }

  listenerNames(type: string): string[] {
    return (this.#listeners.get(type) ?? []).map((entry) => entry.name)
  }

  async dispatch(
    event: StoredEvent,
    deps: { uow: Transactional; deliveries: DeliveryRepository },
  ): Promise<void> {
    for (const listener of this.#listeners.get(event.type) ?? []) {
      await deps.uow.run(async (tx) => {
        const firstDelivery = await deps.deliveries.tryRecord(tx, event.id, listener.name)
        if (!firstDelivery) {
          return
        }
        await listener.handle(event, { tx })
      })
    }
  }
}
