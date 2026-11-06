import { describe, expect, it } from 'vitest'
import { EnvValidationError, loadEnv } from '../../start/env.js'
import { BASE_TEST_ENV, TEST_BLIND_INDEX_KEY, TEST_ENCRYPTION_KEY } from '../helpers/create_test_app.js'

const VALID: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  ENCRYPTION_KEYS: BASE_TEST_ENV.ENCRYPTION_KEYS,
  ENCRYPTION_ACTIVE_KEY_VERSION: '1',
  BLIND_INDEX_KEY: TEST_BLIND_INDEX_KEY,
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
    expect(env.RATE_LIMIT_GLOBAL_PER_MINUTE).toBe(120)
    expect(env.TRUST_PROXY).toBe(false)
    expect(env.QUEUE_PREFIX).toBe('envo')
  })

  it('refuse de démarrer si une variable obligatoire manque, en nommant la variable', () => {
    const issues = failure({}).issues.join('\n')
    for (const name of ['DATABASE_URL', 'REDIS_URL', 'ENCRYPTION_KEYS', 'BLIND_INDEX_KEY']) {
      expect(issues).toContain(name)
    }
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

  describe('sécurité', () => {
    it('décode le trousseau versionné et la clé d\'index aveugle', () => {
      const env = loadEnv({
        ...VALID,
        ENCRYPTION_KEYS: `1:${TEST_ENCRYPTION_KEY},2:${TEST_BLIND_INDEX_KEY}`,
        ENCRYPTION_ACTIVE_KEY_VERSION: '2',
      })
      expect([...env.ENCRYPTION_KEYS.keys()]).toEqual([1, 2])
      expect(env.ENCRYPTION_KEYS.get(1)?.length).toBe(32)
      expect(env.BLIND_INDEX_KEY.length).toBe(32)
    })

    it('refuse une clé mal formée sans la divulguer', () => {
      const error = failure({ ...VALID, ENCRYPTION_KEYS: '1:pas-du-base64-valide!' })
      expect(error.message).toContain('ENCRYPTION_KEYS')
      expect(error.message).not.toContain('pas-du-base64-valide')
    })

    it('refuse une clé de mauvaise taille', () => {
      const shortKey = Buffer.alloc(16, 1).toString('base64')
      expect(failure({ ...VALID, ENCRYPTION_KEYS: `1:${shortKey}` }).issues.join('\n')).toContain('ENCRYPTION_KEYS')
      expect(failure({ ...VALID, BLIND_INDEX_KEY: shortKey }).issues.join('\n')).toContain('BLIND_INDEX_KEY')
    })

    it('refuse des versions en double', () => {
      const keys = `1:${TEST_ENCRYPTION_KEY},1:${TEST_BLIND_INDEX_KEY}`
      expect(failure({ ...VALID, ENCRYPTION_KEYS: keys }).issues.join('\n')).toContain('ENCRYPTION_KEYS')
    })

    it('exige que la version active existe dans le trousseau', () => {
      const error = failure({ ...VALID, ENCRYPTION_ACTIVE_KEY_VERSION: '2' })
      expect(error.issues.join('\n')).toContain('ENCRYPTION_ACTIVE_KEY_VERSION')
    })

    it('lit TRUST_PROXY', () => {
      expect(loadEnv({ ...VALID, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true)
      expect(failure({ ...VALID, TRUST_PROXY: 'oui' }).issues.join('\n')).toContain('TRUST_PROXY')
    })
  })

  it('valide le préfixe des files', () => {
    expect(failure({ ...VALID, QUEUE_PREFIX: 'Mauvais Préfixe' }).issues.join('\n')).toContain('QUEUE_PREFIX')
  })
})
