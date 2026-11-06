import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UNIT_OF_WORK_SETTINGS,
  isSerializationFailure,
  UnitOfWork,
  type TransactionRunner,
  type Tx,
} from '../../app/core/database/unit_of_work.js'
import { createLogger } from '../../app/core/logger/logger.js'
import { fakeTx } from '../helpers/fakes.js'

class FakeRunner implements TransactionRunner {
  calls = 0

  constructor(private readonly failures: unknown[]) {}

  async run<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
    this.calls++
    const failure = this.failures.shift()
    if (failure !== undefined) {
      throw failure
    }
    return operation(fakeTx)
  }
}

const conflict = (): Error => Object.assign(new Error('write conflict'), { code: 'P2034' })

function build(failures: unknown[], maxAttempts = 3) {
  const runner = new FakeRunner(failures)
  const uow = new UnitOfWork(
    runner,
    { ...DEFAULT_UNIT_OF_WORK_SETTINGS, maxAttempts },
    { logger: createLogger({ level: 'silent' }), sleep: async () => {}, random: () => 0 },
  )
  return { runner, uow }
}

describe('UnitOfWork', () => {
  it('exécute l\'opération une fois quand tout va bien', async () => {
    const { runner, uow } = build([])
    expect(await uow.run(async () => 'fait')).toBe('fait')
    expect(runner.calls).toBe(1)
  })

  it('rejoue la transaction après un conflit de sérialisation', async () => {
    const { runner, uow } = build([conflict(), conflict()])
    expect(await uow.run(async () => 'fait')).toBe('fait')
    expect(runner.calls).toBe(3)
  })

  it('abandonne après le nombre de tentatives maximal', async () => {
    const { runner, uow } = build([conflict(), conflict(), conflict(), conflict()])
    await expect(uow.run(async () => 'fait')).rejects.toThrow('write conflict')
    expect(runner.calls).toBe(3)
  })

  it('permet de réduire le nombre de tentatives pour une opération', async () => {
    const { runner, uow } = build([conflict(), conflict()])
    await expect(uow.run(async () => 'fait', { maxAttempts: 1 })).rejects.toThrow()
    expect(runner.calls).toBe(1)
  })

  it('ne rejoue pas une erreur qui n\'est pas un conflit', async () => {
    const { runner, uow } = build([new Error('contrainte violée')])
    await expect(uow.run(async () => 'fait')).rejects.toThrow('contrainte violée')
    expect(runner.calls).toBe(1)
  })
})

describe('isSerializationFailure', () => {
  it('reconnaît les conflits Prisma et PostgreSQL', () => {
    expect(isSerializationFailure({ code: 'P2034' })).toBe(true)
    expect(isSerializationFailure({ code: 'P2010', meta: { code: '40001' } })).toBe(true)
    expect(isSerializationFailure({ code: 'P2010', meta: { code: '40P01' } })).toBe(true)
    expect(isSerializationFailure(new Error('could not serialize access due to concurrent update'))).toBe(true)
    expect(isSerializationFailure(new Error('deadlock detected'))).toBe(true)
  })

  it('ignore les autres erreurs', () => {
    expect(isSerializationFailure(new Error('autre'))).toBe(false)
    expect(isSerializationFailure({ code: 'P2002' })).toBe(false)
    expect(isSerializationFailure(null)).toBe(false)
    expect(isSerializationFailure('texte')).toBe(false)
  })
})
