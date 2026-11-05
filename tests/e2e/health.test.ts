import { describe, expect, it } from 'vitest'
import { createTestApp } from '../helpers/create_test_app.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const upProbe = { name: 'postgres', check: async () => {} }
const downProbe = {
  name: 'redis',
  check: async () => {
    throw new Error('connexion refusée vers secret-host:6379')
  },
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

describe('GET /health/live', () => {
  it('répond 200 avec identifiant de corrélation et en-têtes de sécurité', async () => {
    const { app } = await createTestApp()
    const response = await app.request('/health/live')

    expect(response.status).toBe(200)
    expect(await readJson(response)).toMatchObject({ status: 'ok' })
    expect(response.headers.get('x-request-id')).toMatch(UUID_PATTERN)
    expect(response.headers.get('strict-transport-security')).toContain('max-age=')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('reprend un X-Request-Id valide', async () => {
    const { app } = await createTestApp()
    const response = await app.request('/health/live', {
      headers: { 'X-Request-Id': 'client-request-123' },
    })
    expect(response.headers.get('x-request-id')).toBe('client-request-123')
  })

  it('remplace un X-Request-Id invalide', async () => {
    const { app } = await createTestApp()
    const response = await app.request('/health/live', {
      headers: { 'X-Request-Id': 'identifiant avec espaces' },
    })
    expect(response.headers.get('x-request-id')).toMatch(UUID_PATTERN)
  })
})

describe('GET /health/ready', () => {
  it('répond 200 quand toutes les sondes sont up', async () => {
    const { app } = await createTestApp([upProbe])
    const response = await app.request('/health/ready')

    expect(response.status).toBe(200)
    expect(await readJson(response)).toMatchObject({
      status: 'ok',
      checks: [{ name: 'postgres', status: 'up' }],
    })
  })

  it('répond 503 sans révéler le détail de l\'erreur quand une sonde est down', async () => {
    const { app } = await createTestApp([upProbe, downProbe])
    const response = await app.request('/health/ready')
    const text = await response.text()

    expect(response.status).toBe(503)
    expect(JSON.parse(text)).toMatchObject({ status: 'degraded' })
    expect(text).toContain('"redis"')
    expect(text).not.toContain('secret-host')
  })

  it('considère une sonde trop lente comme down', async () => {
    const slowProbe = { name: 'slow', check: () => new Promise<void>(() => {}) }
    const { app } = await createTestApp([slowProbe], { HEALTH_PROBE_TIMEOUT_MS: '50' })
    const response = await app.request('/health/ready')

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({ checks: [{ name: 'slow', status: 'down' }] })
  })
})

describe('GET /health/version', () => {
  it('expose la version', async () => {
    const { app } = await createTestApp([], { APP_VERSION: '1.2.3' })
    const response = await app.request('/health/version')
    expect(await readJson(response)).toEqual({ version: '1.2.3', commit: null })
  })
})

describe('erreurs HTTP (application/problem+json)', () => {
  it('renvoie un 404 structuré avec le requestId', async () => {
    const { app } = await createTestApp()
    const response = await app.request('/inconnu')
    const body = await readJson(response)

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/problem+json')
    expect(body).toMatchObject({ status: 404, code: 'not_found' })
    expect(body['requestId']).toBe(response.headers.get('x-request-id'))
  })

  it('masque les erreurs inattendues derrière un 500 générique', async () => {
    const { app } = await createTestApp()
    app.get('/boom', () => {
      throw new Error('boom: password=hunter2')
    })
    const response = await app.request('/boom')
    const text = await response.text()

    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toMatchObject({ code: 'internal_error' })
    expect(text).not.toContain('hunter2')
    expect(text).not.toContain('boom')
  })

  it('refuse un corps trop volumineux (413)', async () => {
    const { app } = await createTestApp([], { BODY_LIMIT_BYTES: '10' })
    app.post('/echo', async (c) => c.text(await c.req.text()))
    const response = await app.request('/echo', {
      method: 'POST',
      headers: { 'content-length': '100' },
      body: 'x'.repeat(100),
    })

    expect(response.status).toBe(413)
    expect(await readJson(response)).toMatchObject({ code: 'payload_too_large' })
  })

  it('n\'autorise aucune origine CORS par défaut', async () => {
    const { app } = await createTestApp()
    const response = await app.request('/health/live', {
      headers: { Origin: 'https://evil.example' },
    })
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('autorise une origine listée', async () => {
    const { app } = await createTestApp([], { CORS_ALLOWED_ORIGINS: 'https://app.example' })
    const response = await app.request('/health/live', {
      headers: { Origin: 'https://app.example' },
    })
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example')
  })
})
