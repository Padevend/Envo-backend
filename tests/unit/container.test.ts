import { describe, expect, it } from 'vitest'
import { Container } from '../../app/core/support/container.js'

interface TestRegistry {
  count: number
  label: string
}

describe('Container', () => {
  it('crée chaque liaison une seule fois, à la demande', () => {
    const container = new Container<TestRegistry>()
    let calls = 0
    container.bind('count', () => ++calls)

    expect(calls).toBe(0)
    expect(container.make('count')).toBe(1)
    expect(container.make('count')).toBe(1)
    expect(calls).toBe(1)
  })

  it('résout une liaison depuis une autre', () => {
    const container = new Container<TestRegistry>()
    container.bindValue('count', 3)
    container.bind('label', (c) => `n=${c.make('count')}`)
    expect(container.make('label')).toBe('n=3')
  })

  it('refuse une liaison en double et une liaison introuvable', () => {
    const container = new Container<TestRegistry>()
    container.bindValue('count', 1)
    expect(() => container.bindValue('count', 2)).toThrow('déjà enregistrée')
    expect(() => container.make('label')).toThrow('introuvable')
  })

  it('ferme les ressources dans l\'ordre inverse', async () => {
    const container = new Container<TestRegistry>()
    const order: string[] = []
    container.onDispose(() => {
      order.push('premier')
    })
    container.onDispose(async () => {
      order.push('second')
    })

    await container.shutdown()
    expect(order).toEqual(['second', 'premier'])
  })

  it('poursuit la fermeture malgré une erreur et les agrège', async () => {
    const container = new Container<TestRegistry>()
    const closed: string[] = []
    container.onDispose(() => {
      closed.push('a')
    })
    container.onDispose(() => {
      throw new Error('échec')
    })

    await expect(container.shutdown()).rejects.toBeInstanceOf(AggregateError)
    expect(closed).toEqual(['a'])
  })
})
