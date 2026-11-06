import { describe, expect, it } from 'vitest'
import { createTestApp } from '../helpers/create_test_app.js'
import { InMemoryRateLimitBackend } from '../helpers/in_memory_rate_limit_backend.js'

describe('rate limit global (kernel)', () => {
  it('bloque au-delà de la limite configurée, sauf sur /health', async () => {
    const { app } = await createTestApp(
      [],
      { RATE_LIMIT_GLOBAL_PER_MINUTE: '2' },
      { rateLimitBackend: new InMemoryRateLimitBackend() },
    )

    expect((await app.request('/inconnu')).status).toBe(404)
    expect((await app.request('/inconnu')).status).toBe(404)
    const blocked = await app.request('/inconnu')
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('content-type')).toContain('application/problem+json')
    expect(blocked.headers.get('retry-after')).not.toBeNull()

    expect((await app.request('/health/live')).status).toBe(200)
  })
})
