import { describe, expect, it } from 'vitest'
import { backoffDelayMs, retry } from '../../app/core/support/retry.js'

const backoff = { baseDelayMs: 100, maxDelayMs: 1_000 }

describe('backoffDelayMs', () => {
  it('croit exponentiellement jusqu\'au plafond (full jitter)', () => {
    const almostOne = (): number => 0.999
    expect(backoffDelayMs(1, backoff, almostOne)).toBe(99)
    expect(backoffDelayMs(2, backoff, almostOne)).toBe(199)
    expect(backoffDelayMs(3, backoff, almostOne)).toBe(399)
    expect(backoffDelayMs(10, backoff, almostOne)).toBe(999)
  })

  it('reste dans [0, plafond]', () => {
    for (let attempt = 1; attempt <= 12; attempt++) {
      const delay = backoffDelayMs(attempt, backoff)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(1_000)
    }
  })
})

describe('retry', () => {
  const noSleep = async (): Promise<void> => {}

  it('réessaie jusqu\'au succès', async () => {
    let calls = 0
    const sleeps: number[] = []
    const result = await retry(
      async () => {
        calls++
        if (calls < 3) {
          throw new Error('transitoire')
        }
        return 'ok'
      },
      {
        maxAttempts: 5,
        shouldRetry: () => true,
        backoff,
        sleep: async (ms) => {
          sleeps.push(ms)
        },
        random: () => 0.5,
      },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(3)
    expect(sleeps).toEqual([50, 100])
  })

  it('abandonne après maxAttempts et relance la dernière erreur', async () => {
    let calls = 0
    await expect(
      retry(
        async () => {
          calls++
          throw new Error(`échec ${calls}`)
        },
        { maxAttempts: 3, shouldRetry: () => true, backoff, sleep: noSleep },
      ),
    ).rejects.toThrow('échec 3')
    expect(calls).toBe(3)
  })

  it('ne réessaie pas une erreur que shouldRetry refuse', async () => {
    let calls = 0
    await expect(
      retry(
        async () => {
          calls++
          throw new Error('définitif')
        },
        { maxAttempts: 5, shouldRetry: () => false, backoff, sleep: noSleep },
      ),
    ).rejects.toThrow('définitif')
    expect(calls).toBe(1)
  })
})
