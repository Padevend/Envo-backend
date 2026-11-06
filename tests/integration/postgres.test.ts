import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_UNIT_OF_WORK_SETTINGS,
  PrismaTransactionRunner,
  UnitOfWork,
} from '../../app/core/database/unit_of_work.js'
import { EventBus, type StoredEvent } from '../../app/core/events/event_bus.js'
import { OutboxPublisher } from '../../app/core/events/outbox_publisher.js'
import { OutboxRelay } from '../../app/core/events/outbox_relay.js'
import { PrismaDeliveryRepository } from '../../app/core/events/prisma_delivery_repository.js'
import { PrismaOutboxRepository } from '../../app/core/events/prisma_outbox_repository.js'
import { PrismaIdempotencyStore } from '../../app/core/idempotency/prisma_idempotency_store.js'
import { createLogger } from '../../app/core/logger/logger.js'
import { systemClock } from '../../app/core/support/clock.js'
import { randomIdGenerator } from '../../app/core/support/ids.js'
import { TEST_EVENT } from '../helpers/events.js'
import { INTEGRATION, requireEnv } from '../helpers/integration.js'

// Nécessite PostgreSQL migré (RUN_INTEGRATION=1 et DATABASE_URL). Ignoré sinon.
describe.skipIf(!INTEGRATION)('intégration PostgreSQL', () => {
  let prisma: PrismaClient
  const logger = createLogger({ level: 'silent' })

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: requireEnv('DATABASE_URL') })
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.listenerDelivery.deleteMany()
    await prisma.outboxEvent.deleteMany()
  })

  describe('PrismaIdempotencyStore', () => {
    const store = (): PrismaIdempotencyStore => new PrismaIdempotencyStore(prisma)
    const newInput = () => ({
      scope: randomUUID(),
      key: randomUUID(),
      endpoint: 'POST /v1/test',
      requestHash: 'hash-1',
      now: new Date(),
      ttlMs: 60_000,
      lockTimeoutMs: 60_000,
    })

    it('verrouille, refuse un doublon en cours, puis rejoue la réponse', async () => {
      const input = newInput()
      const response = { status: 201, contentType: 'application/json', body: '{"ok":true}' }

      expect(await store().begin(input)).toEqual({ state: 'acquired' })
      expect(await store().begin(input)).toEqual({ state: 'in_progress' })
      expect(await store().begin({ ...input, requestHash: 'hash-2' })).toEqual({ state: 'mismatch' })

      await store().complete(input, response, new Date())
      expect(await store().begin(input)).toEqual({ state: 'replay', response })
      expect(await store().begin({ ...input, requestHash: 'hash-2' })).toEqual({ state: 'mismatch' })
    })

    it('permet de réessayer après une libération', async () => {
      const input = newInput()
      expect(await store().begin(input)).toEqual({ state: 'acquired' })
      await store().release(input)
      expect(await store().begin(input)).toEqual({ state: 'acquired' })
    })

    it('ne libère pas une requête déjà terminée', async () => {
      const input = newInput()
      const response = { status: 200, contentType: 'application/json', body: '{}' }
      await store().begin(input)
      await store().complete(input, response, new Date())
      await store().release(input)
      expect(await store().begin(input)).toEqual({ state: 'replay', response })
    })

    it('reprend un verrou périmé (processus mort)', async () => {
      const input = newInput()
      await store().begin(input)
      const later = { ...input, now: new Date(input.now.getTime() + 120_000) }
      expect(await store().begin(later)).toEqual({ state: 'acquired' })
    })

    it('n\'accorde le verrou qu\'à une seule requête parmi dix simultanées', async () => {
      const input = newInput()
      const results = await Promise.all(Array.from({ length: 10 }, () => store().begin(input)))
      expect(results.filter((result) => result.state === 'acquired')).toHaveLength(1)
      expect(results.filter((result) => result.state === 'in_progress')).toHaveLength(9)
    })

    it('purge les clés expirées', async () => {
      const input = { ...newInput(), now: new Date(Date.now() - 10_000), ttlMs: 1_000 }
      await store().begin(input)
      expect(await store().purgeExpired(new Date())).toBeGreaterThanOrEqual(1)
      expect(await store().begin({ ...input, now: new Date() })).toEqual({ state: 'acquired' })
    })
  })

  describe('UnitOfWork, outbox et relais', () => {
    const uow = (): UnitOfWork =>
      new UnitOfWork(new PrismaTransactionRunner(prisma), DEFAULT_UNIT_OF_WORK_SETTINGS, { logger })
    const outbox = (): PrismaOutboxRepository => new PrismaOutboxRepository(prisma)
    const publisher = (): OutboxPublisher =>
      new OutboxPublisher(outbox(), randomIdGenerator, systemClock)
    const relayFor = (bus: EventBus, maxAttempts = 2): OutboxRelay =>
      new OutboxRelay({
        outbox: outbox(),
        bus,
        uow: uow(),
        deliveries: new PrismaDeliveryRepository(),
        clock: systemClock,
        logger,
        settings: {
          batchSize: 10,
          leaseMs: 30_000,
          maxAttempts,
          backoff: { baseDelayMs: 1_000, maxDelayMs: 1_000 },
        },
      })

    it('écrit l\'événement avec la transaction : validé ensemble, annulé ensemble', async () => {
      const committedId = await uow().run((tx) => publisher().publish(tx, TEST_EVENT, { value: 'ok' }))

      await expect(
        uow().run(async (tx) => {
          await publisher().publish(tx, TEST_EVENT, { value: 'annulé' })
          throw new Error('rollback voulu')
        }),
      ).rejects.toThrow('rollback voulu')

      const rows = await prisma.outboxEvent.findMany()
      expect(rows.map((row) => row.id)).toEqual([committedId])
      expect(rows[0]).toMatchObject({ type: TEST_EVENT, status: 'PENDING', attempts: 0 })
    })

    it('livre l\'événement à un listener une seule fois, de bout en bout', async () => {
      const bus = new EventBus()
      const received: string[] = []
      bus.subscribe(TEST_EVENT, 'integration.recorder', async (event) => {
        received.push(event.payload.value)
      })
      const id = await uow().run((tx) => publisher().publish(tx, TEST_EVENT, { value: 'bonjour' }))
      const relay = relayFor(bus)

      expect(await relay.runOnce()).toEqual({ claimed: 1, published: 1, failed: 0, dead: 0 })
      expect(received).toEqual(['bonjour'])
      expect(await prisma.outboxEvent.findUnique({ where: { id } })).toMatchObject({
        status: 'PUBLISHED',
        attempts: 1,
      })
      expect(await prisma.listenerDelivery.count({ where: { eventId: id } })).toBe(1)

      expect((await relay.runOnce()).claimed).toBe(0)
      expect(received).toHaveLength(1)
    })

    it('ne traite pas deux fois un événement pour un même listener', async () => {
      const bus = new EventBus()
      let calls = 0
      bus.subscribe(TEST_EVENT, 'integration.once', async () => {
        calls++
      })
      const event: StoredEvent = {
        id: randomUUID(),
        type: TEST_EVENT,
        aggregateId: null,
        payload: { value: 'x' },
        occurredAt: new Date(),
      }
      const deps = { uow: uow(), deliveries: new PrismaDeliveryRepository() }

      await bus.dispatch(event, deps)
      await bus.dispatch(event, deps)
      expect(calls).toBe(1)
    })

    it('annule les effets d\'un listener en échec et reprogramme l\'événement', async () => {
      const flagKey = `flag-${randomUUID()}`
      const bus = new EventBus()
      bus.subscribe(TEST_EVENT, 'integration.failing', async (_event, { tx }) => {
        await tx.systemFlag.create({ data: { key: flagKey, enabled: true } })
        throw new Error('listener en échec')
      })
      const id = await uow().run((tx) => publisher().publish(tx, TEST_EVENT, { value: 'x' }))

      expect(await relayFor(bus).runOnce()).toEqual({ claimed: 1, published: 0, failed: 1, dead: 0 })

      expect(await prisma.systemFlag.findUnique({ where: { key: flagKey } })).toBeNull()
      expect(await prisma.listenerDelivery.count({ where: { eventId: id } })).toBe(0)
      const row = await prisma.outboxEvent.findUnique({ where: { id } })
      expect(row).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'listener en échec' })
      expect(row?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() - 1_000)
    })

    it('ne réserve un événement qu'une fois même avec des relais concurrents', async () => {
      const bus = new EventBus()
      let calls = 0
      bus.subscribe(TEST_EVENT, 'integration.concurrent', async () => {
        calls++
      })
      await uow().run((tx) => publisher().publish(tx, TEST_EVENT, { value: 'x' }))

      const results = await Promise.all([relayFor(bus).runOnce(), relayFor(bus).runOnce(), relayFor(bus).runOnce()])
      expect(results.reduce((total, result) => total + result.claimed, 0)).toBe(1)
      expect(calls).toBe(1)
    })
  })
})
