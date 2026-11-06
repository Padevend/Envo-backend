import { describe, expect, it } from 'vitest'
import { EventBus } from '../../app/core/events/event_bus.js'
import { OutboxPublisher } from '../../app/core/events/outbox_publisher.js'
import { OutboxRelay } from '../../app/core/events/outbox_relay.js'
import { createLogger } from '../../app/core/logger/logger.js'
import { randomIdGenerator } from '../../app/core/support/ids.js'
import { TEST_EVENT } from '../helpers/events.js'
import {
  FakeDeliveryRepository,
  FakeOutboxRepository,
  FakeUow,
  MutableClock,
  fakeTx,
} from '../helpers/fakes.js'

function setup(maxAttempts = 3) {
  const clock = new MutableClock(new Date('2026-01-01T00:00:00Z'))
  const outbox = new FakeOutboxRepository()
  const deliveries = new FakeDeliveryRepository()
  const uow = new FakeUow(deliveries)
  const bus = new EventBus()
  const relay = new OutboxRelay({
    outbox,
    bus,
    uow,
    deliveries,
    clock,
    logger: createLogger({ level: 'silent' }),
    random: () => 0.5,
    settings: {
      batchSize: 10,
      leaseMs: 30_000,
      maxAttempts,
      backoff: { baseDelayMs: 1_000, maxDelayMs: 1_000 },
    },
  })
  const publisher = new OutboxPublisher(outbox, randomIdGenerator, clock)
  return { clock, outbox, bus, relay, publisher }
}

describe('outbox et relais', () => {
  it('écrit l\'événement dans l\'outbox et le livre une seule fois', async () => {
    const { outbox, bus, relay, publisher } = setup()
    const received: Array<{ type: string; value: string; sameTx: boolean }> = []
    bus.subscribe(TEST_EVENT, 'test.recorder', async (event, context) => {
      received.push({ type: event.type, value: event.payload.value, sameTx: context.tx === fakeTx })
    })

    const id = await publisher.publish(fakeTx, TEST_EVENT, { value: 'x' }, 'aggregate-1')
    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0]).toMatchObject({ id, status: 'PENDING', aggregateId: 'aggregate-1' })

    expect(await relay.runOnce()).toEqual({ claimed: 1, published: 1, failed: 0, dead: 0 })
    expect(received).toEqual([{ type: TEST_EVENT, value: 'x', sameTx: true }])
    expect(outbox.rows[0]?.status).toBe('PUBLISHED')

    expect((await relay.runOnce()).claimed).toBe(0)
    expect(received).toHaveLength(1)
  })

  it('publie un événement sans listener', async () => {
    const { outbox, relay, publisher } = setup()
    await publisher.publish(fakeTx, TEST_EVENT, { value: 'x' })
    expect((await relay.runOnce()).published).toBe(1)
    expect(outbox.rows[0]?.status).toBe('PUBLISHED')
  })

  it('refuse deux listeners de même nom pour un même type', () => {
    const { bus } = setup()
    bus.subscribe(TEST_EVENT, 'doublon', async () => {})
    expect(() => bus.subscribe(TEST_EVENT, 'doublon', async () => {})).toThrow('déjà enregistré')
    expect(bus.listenerNames(TEST_EVENT)).toEqual(['doublon'])
  })

  it('reprogramme un échec sans rejouer les listeners déjé servis', async () => {
    const { clock, outbox, bus, relay, publisher } = setup()
    let successCalls = 0
    let flakyCalls = 0
    bus.subscribe(TEST_EVENT, 'test.ok', async () => {
      successCalls++
    })
    bus.subscribe(TEST_EVENT, 'test.flaky', async () => {
      flakyCalls++
      if (flakyCalls === 1) {
        throw new Error('panne temporaire')
      }
    })
    await publisher.publish(fakeTx, TEST_EVENT, { value: 'x' })

    expect(await relay.runOnce()).toEqual({ claimed: 1, published: 0, failed: 1, dead: 0 })
    expect(outbox.rows[0]).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'panne temporaire' })
    expect(successCalls).toBe(1)

    // Pas encore échu : le délai de reprise n'est pas écoulé.
    expect((await relay.runOnce()).claimed).toBe(0)

    clock.advance(60_000)
    expect(await relay.runOnce()).toEqual({ claimed: 1, published: 1, failed: 0, dead: 0 })
    expect(successCalls).toBe(1) // déjà livré : pas rejoué
    expect(flakyCalls).toBe(2)
    expect(outbox.rows[0]?.status).toBe('PUBLISHED')
  })

  it('met l\'événement en DEAD après maxAttempts, sans le perdre', async () => {
    const { clock, outbox, bus, relay, publisher } = setup(3)
    bus.subscribe(TEST_EVENT, 'test.broken', async () => {
      throw new Error('toujours en échec')
    })
    await publisher.publish(fakeTx, TEST_EVENT, { value: 'x' })

    expect((await relay.runOnce()).failed).toBe(1)
    clock.advance(60_000)
    expect((await relay.runOnce()).failed).toBe(1)
    clock.advance(60_000)
    expect(await relay.runOnce()).toEqual({ claimed: 1, published: 0, failed: 0, dead: 1 })
    expect(outbox.rows[0]).toMatchObject({ status: 'DEAD', attempts: 3, lastError: 'toujours en échec' })

    clock.advance(60_000)
    expect((await relay.runOnce()).claimed).toBe(0)
    expect(outbox.rows).toHaveLength(1)
  })

  it('reprend un événement dont le relais est mort après expiration du bail', async () => {
    const { clock, outbox, relay, publisher } = setup()
    await publisher.publish(fakeTx, TEST_EVENT, { value: 'x' })
    // Un relais réserve l'événement puis meurt sans le traiter.
    await outbox.claim(10, clock.now(), 30_000)
    expect((await relay.runOnce()).claimed).toBe(0)

    clock.advance(31_000)
    expect(await relay.runOnce()).toMatchObject({ claimed: 1, published: 1 })
    expect(outbox.rows[0]?.attempts).toBe(2)
  })
})
