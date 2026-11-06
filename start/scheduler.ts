import type { Queue } from 'bullmq'
import type { Config } from '../config/index.js'

/**
 * Tâches répétables (idempotentes : `upsertJobScheduler` ne crée pas de doublon au redémarrage).
 * Les crons de réconciliation (00:00 Africa/Douala) seront déclarés ici en Phase 6.
 */
export async function registerSchedules(
  queues: { outbox: Queue; maintenance: Queue },
  config: Config,
): Promise<void> {
  await queues.outbox.upsertJobScheduler(
    'outbox-relay',
    { every: config.queue.outboxRelayIntervalMs },
    { name: 'relay', data: {} },
  )
  await queues.maintenance.upsertJobScheduler(
    'idempotency-purge',
    { pattern: '17 * * * *', tz: 'Africa/Douala' },
    { name: 'purge-idempotency', data: {} },
  )
}
