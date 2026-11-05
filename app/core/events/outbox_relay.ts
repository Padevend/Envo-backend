import type { Logger } from 'pino'
import type { Transactional } from '../database/unit_of_work.js'
import type { Clock } from '../support/clock.js'
import { backoffDelayMs, type BackoffOptions } from '../support/retry.js'
import type { DeliveryRepository } from './delivery_repository.js'
import type { EventBus } from './event_bus.js'
import type { OutboxRepository } from './outbox_repository.js'

export interface OutboxRelaySettings {
  batchSize: number
  leaseMs: number
  maxAttempts: number
  backoff: BackoffOptions
}

export interface OutboxRelayDeps {
  outbox: OutboxRepository
  bus: EventBus
  uow: Transactional
  deliveries: DeliveryRepository
  clock: Clock
  logger: Logger
  settings: OutboxRelaySettings
  random?: () => number
}

export interface RelayResult {
  claimed: number
  published: number
  failed: number
  dead: number
}

const MAX_ERROR_LENGTH = 500

/**
 * Publie les événements de l'outbox vers les listeners. Un échec reprogramme l'événement avec un
 * délai exponentiel ; au-delà de `maxAttempts` il passe en DEAD (à examiner, jamais perdu).
 * Les listeners déjà servis ne sont pas rejoués (table des livraisons).
 */
export class OutboxRelay {
  constructor(private readonly deps: OutboxRelayDeps) {}

  async runOnce(): Promise<RelayResult> {
    const { outbox, bus, uow, deliveries, clock, logger, settings } = this.deps
    const records = await outbox.claim(settings.batchSize, clock.now(), settings.leaseMs)
    const result: RelayResult = { claimed: records.length, published: 0, failed: 0, dead: 0 }

    for (const record of records) {
      try {
        await bus.dispatch(record, { uow, deliveries })
        await outbox.markPublished(record.id, clock.now())
        result.published++
      } catch (error) {
        const dead = record.attempts >= settings.maxAttempts
        const delay = backoffDelayMs(record.attempts, settings.backoff, this.deps.random)
        await outbox.markFailed(record.id, {
          nextAttemptAt: new Date(clock.now().getTime() + delay),
          lastError: (error instanceof Error ? error.message : 'erreur inconnue').slice(
            0,
            MAX_ERROR_LENGTH,
          ),
          dead,
        })
        if (dead) {
          result.dead++
        } else {
          result.failed++
        }
        logger.error(
          { err: error, eventId: record.id, type: record.type, attempts: record.attempts, dead },
          'outbox_event_failed',
        )
      }
    }
    return result
  }
}
