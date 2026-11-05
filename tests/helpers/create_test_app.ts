import type { Hono } from 'hono'
import type { AppEnv } from '../../app/core/http/app_env.js'
import type { Container } from '../../app/core/support/container.js'
import type { HealthProbe } from '../../app/modules/system/index.js'
import { createApp } from '../../start/app.js'
import { createContainer } from '../../start/container.js'
import { loadEnv } from '../../start/env.js'

export const BASE_TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'silent',
} as const

export function testEnv(overrides: Record<string, string> = {}) {
  return loadEnv({ ...BASE_TEST_ENV, ...overrides })
}

/** Application complète, sans serveur ni base : les sondes de santé sont injectées. */
export async function createTestApp(
  probes: readonly HealthProbe[] = [],
  envOverrides: Record<string, string> = {},
): Promise<{ app: Hono<AppEnv>; container: Container }> {
  const container = createContainer(testEnv(envOverrides))
  container.bindValue('healthProbes', probes)
  const app = await createApp(container)
  return { app, container }
}
