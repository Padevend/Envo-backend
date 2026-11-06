import { describe, expect, it } from 'vitest'
import { redisConnectionOptions } from '../../app/core/queue/connection.js'
import { QUEUES } from '../../app/core/queue/queues.js'

describe('redisConnectionOptions', () => {
  it('lit hôte et port, avec le port par défaut', () => {
    expect(redisConnectionOptions('redis://cache.internal:6380')).toEqual({
      host: 'cache.internal',
      port: 6380,
      maxRetriesPerRequest: null,
    })
    expect(redisConnectionOptions('redis://localhost')).toMatchObject({ host: 'localhost', port: 6379 })
  })

  it('lit identifiants (décodés), base et TLS', () => {
    expect(redisConnectionOptions('rediss://worker:p%40ss@redis.example:6379/2')).toEqual({
      host: 'redis.example',
      port: 6379,
      username: 'worker',
      password: 'p@ss',
      db: 2,
      tls: {},
      maxRetriesPerRequest: null,
    })
  })
})

describe('QUEUES', () => {
  it('expose les noms de files', () => {
    expect(QUEUES).toEqual({ outbox: 'outbox', maintenance: 'maintenance', deadLetter: 'dead-letter' })
  })
})
