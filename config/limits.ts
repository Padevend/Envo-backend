import { z } from 'zod'

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback)

export const limitsEnvSchema = z.object({
  BODY_LIMIT_BYTES: positiveInt(1_048_576),
  REQUEST_TIMEOUT_MS: positiveInt(15_000),
  HEALTH_PROBE_TIMEOUT_MS: positiveInt(2_000),
  SHUTDOWN_GRACE_MS: positiveInt(10_000),
})

export function limitsConfig(env: z.infer<typeof limitsEnvSchema>) {
  return {
    bodyLimitBytes: env.BODY_LIMIT_BYTES,
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    healthProbeTimeoutMs: env.HEALTH_PROBE_TIMEOUT_MS,
    shutdownGraceMs: env.SHUTDOWN_GRACE_MS,
  } as const
}
