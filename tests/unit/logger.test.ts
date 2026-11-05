import { describe, expect, it } from 'vitest'
import { createLogger } from '../../app/core/logger/logger.js'

function capture() {
  const lines: string[] = []
  const logger = createLogger(
    { level: 'info' },
    {
      write: (message: string) => {
        lines.push(message)
      },
    },
  )
  return { logger, output: () => lines.join('') }
}

describe('logger : redaction des données sensibles', () => {
  it('masque PIN, OTP, jetons, numéros et en-tête Authorization', () => {
    const { logger, output } = capture()
    logger.info(
      {
        pin: '123456',
        otp: '654321',
        user: { phone: '+237612345678', refreshToken: 'rt-secret-value' },
        req: { headers: { authorization: 'Bearer jwt-secret-value' } },
      },
      'test',
    )

    const text = output()
    for (const secret of ['123456', '654321', '+237612345678', 'rt-secret-value', 'jwt-secret-value']) {
      expect(text).not.toContain(secret)
    }
    expect(text).toContain('[REDACTED]')
  })

  it('conserve les champs non sensibles', () => {
    const { logger, output } = capture()
    logger.info({ code: 'not_found', status: 404 }, 'request_rejected')
    expect(output()).toContain('not_found')
    expect(output()).toContain('request_rejected')
  })
})
