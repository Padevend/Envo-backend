import type { Hono } from 'hono'
import type { AppEnv } from '../../app/core/http/app_env.js'
import type { RateLimitBackend } from '../../app/core/rate_limit/rate_limit_backend.js'
import type { Container } from '../../app/core/support/container.js'
import type { HealthProbe } from '../../app/modules/system/index.js'
import { createApp } from '../../start/app.js'
import { createContainer } from '../../start/container.js'
import { loadEnv } from '../../start/env.js'
import { unlimitedBackend } from './in_memory_rate_limit_backend.js'

// Clés de test (32 octets, base64) : jamais utilisées hors tests.
export const TEST_ENCRYPTION_KEY = `${'A'.repeat(43)}=`
export const TEST_BLIND_INDEX_KEY = `${'Q'.repeat(43)}=`

export const BASE_TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'silent',
  ENCRYPTION_KEYS: `1:${TEST_ENCRYPTION_KEY}`,
  ENCRYPTION_ACTIVE_KEY_VERSION: '1',
  BLIND_INDEX_KEY: TEST_BLIND_INDEX_KEY,
} as const

export function testEnv(overrides: Record<string, string> = {}) {
  return loadEnv({ ...BASE_TEST_ENV, ...overrides })
}

/** Application complète, sans serveur ni base : sondes de santé et limiteur de débit sont injectés. */
export async function createTestApp(
  probes: readonly HealthProbe[] = [],
  envOverrides: Record<string, string> = {},
  options: { rateLimitBackend?: RateLimitBackend } = {},
): Promise<{ app: Hono<AppEnv>; container: Container }> {
  const container = createContainer(testEnv(envOverrides))
  container.bindValue('healthProbes', probes)
  container.replaceValue('rateLimitBackend', options.rateLimitBackend ?? unlimitedBackend)
  const app = await createApp(container)
  return { app, container }
}
