import { z } from 'zod'

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback)

export const queueEnvSchema = z.object({
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-z0-9_-]+$/, 'caractères autorisés : a-z, 0-9, _ et -')
    .default('envo'),
  OUTBOX_RELAY_INTERVAL_MS: positiveInt(2_000),
  OUTBOX_BATCH_SIZE: positiveInt(50),
  OUTBOX_MAX_ATTEMPTS: positiveInt(10),
  OUTBOX_LEASE_MS: positiveInt(30_000),
})

export function queueConfig(env: z.infer<typeof queueEnvSchema>) {
  return {
    prefix: env.QUEUE_PREFIX,
    outboxRelayIntervalMs: env.OUTBOX_RELAY_INTERVAL_MS,
    outboxBatchSize: env.OUTBOX_BATCH_SIZE,
    outboxMaxAttempts: env.OUTBOX_MAX_ATTEMPTS,
    outboxLeaseMs: env.OUTBOX_LEASE_MS,
  } as const
}
