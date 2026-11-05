import { describe, expect, it } from 'vitest'
import { EnvValidationError, loadEnv } from '../../start/env.js'

const VALID = {
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
}

function failure(source: Record<string, string>): EnvValidationError {
  try {
    loadEnv(source)
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return error
    }
    throw error
  }
  throw new Error('aucune erreur levée')
}

describe('loadEnv', () => {
  it('accepte une configuration minimale et applique les valeurs par défaut', () => {
    const env = loadEnv(VALID)
    expect(env.NODE_ENV).toBe('development')
    expect(env.APP_PORT).toBe(3000)
    expect(env.LOG_LEVEL).toBe('info')
    expect(env.CORS_ALLOWED_ORIGINS).toEqual([])
    expect(env.BODY_LIMIT_BYTES).toBe(1_048_576)
  })

  it('refuse de démarrer si une variable obligatoire manque, en nommant la variable', () => {
    const error = failure({})
    expect(error.issues.join('\n')).toContain('DATABASE_URL')
    expect(error.issues.join('\n')).toContain('REDIS_URL')
  })

  it('ne divulgue jamais la valeur d\'une variable invalide', () => {
    const error = failure({ ...VALID, DATABASE_URL: 'mysql://user:supersecret@host/db' })
    expect(error.message).toContain('DATABASE_URL')
    expect(error.message).not.toContain('supersecret')
  })

  it('refuse un port hors limites', () => {
    expect(failure({ ...VALID, APP_PORT: '70000' }).issues.join('\n')).toContain('APP_PORT')
  })

  it('découpe CORS_ALLOWED_ORIGINS en liste', () => {
    const env = loadEnv({ ...VALID, CORS_ALLOWED_ORIGINS: ' https://a.example , https://b.example ,' })
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['https://a.example', 'https://b.example'])
  })
})
