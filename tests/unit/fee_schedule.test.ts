import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FeeScheduleError } from '../../app/modules/payments/exceptions/fee_errors.js'
import { parseFeeSchedule } from '../../app/modules/payments/models/fee_schedule.js'
import { loadFeeScheduleFile } from '../../app/modules/payments/repositories/fee_schedule_repository.js'

const validRule = {
  enabled: true,
  verified: true,
  tiers: [{ upTo: null, fixed: '0', bps: 100 }],
}

const base = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 1,
  currency: 'XAF',
  appFee: { bps: 50, appliesTo: ['COLLECT'] },
  mesomb: { CM: { MTN_MOMO: { COLLECT: validRule } } },
  ...overrides,
})

function issuesOf(json: unknown): string {
  try {
    parseFeeSchedule(json)
  } catch (error) {
    if (error instanceof FeeScheduleError) {
      return error.message
    }
    throw error
  }
  return ''
}

describe('barème fourni (config/fees.json)', () => {
  const schedule = loadFeeScheduleFile('config/fees.json')

  it('est valide', () => {
    expect(schedule.version).toBe(1)
    expect(schedule.currency).toBe('XAF')
  })

  it('respecte le plafond de 1 % des frais de l\'application', () => {
    expect(schedule.appFee.bps).toBeLessThanOrEqual(100)
  })

  it('n\'active aucun barème MeSomb qui n\'ait été vérifié', () => {
    for (const providers of Object.values(schedule.mesomb)) {
      for (const operations of Object.values(providers)) {
        for (const rule of Object.values(operations)) {
          if (rule === undefined) {
            continue
          }
          expect(rule.enabled === false || rule.verified === true).toBe(true)
        }
      }
    }
  })
})

describe('validation du barème', () => {
  it('accepte un barème minimal et applique les valeurs par défaut', () => {
    const parsed = parseFeeSchedule(base())
    expect(parsed.appFee).toMatchObject({ bps: 50, min: '0', max: null, rounding: 'HALF_UP' })
    expect(parsed.mesomb['CM']?.['MTN_MOMO']?.COLLECT).toMatchObject({ min: '0', max: null, rounding: 'CEIL' })
  })

  it('plafonne les frais de l\'application à 1 %', () => {
    expect(issuesOf(base({ appFee: { bps: 101, appliesTo: ['COLLECT'] } }))).toContain('appFee.bps')
  })

  it('vérifie les paliers : croissants, dernier ouvert, un seul palier ouvert', () => {
    const withTiers = (tiers: unknown[]) =>
      base({ mesomb: { CM: { MTN_MOMO: { COLLECT: { ...validRule, tiers } } } } })
    expect(issuesOf(withTiers([{ upTo: '1000' }]))).toContain('le dernier palier doit être ouvert')
    expect(issuesOf(withTiers([{ upTo: '5000' }, { upTo: '1000' }, { upTo: null }]))).toContain('strictement croissants')
    expect(issuesOf(withTiers([{ upTo: null }, { upTo: null }]))).toContain('seul le dernier palier')
    expect(issuesOf(withTiers([]))).not.toBe('')
  })

  it('refuse les montants décimaux ou négatifs et max < min', () => {
    const withRule = (extra: Record<string, unknown>) =>
      base({ mesomb: { CM: { MTN_MOMO: { COLLECT: { ...validRule, ...extra } } } } })
    expect(issuesOf(withRule({ min: '10.5' }))).toContain('mesomb.CM.MTN_MOMO.COLLECT.min')
    expect(issuesOf(withRule({ min: '-1' }))).not.toBe('')
    expect(issuesOf(withRule({ min: '100', max: '50' }))).toContain('max doit être supérieur')
  })

  it('refuse les clés inconnues, pays et moyens de paiement mal nommés', () => {
    expect(issuesOf(base({ inconnu: true }))).not.toBe('')
    // Zod signale une clé de dictionnaire invalide par son chemin (le message du motif n\'est pas repris).
    expect(issuesOf(base({ mesomb: { cm: { MTN_MOMO: { COLLECT: validRule } } } }))).toContain('mesomb.cm')
    expect(issuesOf(base({ mesomb: { CM: { 'mtn momo': { COLLECT: validRule } } } }))).toContain('mesomb.CM.mtn momo')
  })

  it('ne reprend jamais les valeurs dans le message', () => {
    expect(issuesOf(base({ appFee: { bps: 'VALEUR-SECRETE', appliesTo: [] } }))).not.toContain('VALEUR-SECRETE')
  })
})

describe('loadFeeScheduleFile', () => {
  it('refuse un fichier introuvable ou un JSON invalide', () => {
    expect(() => loadFeeScheduleFile('config/n-existe-pas.json')).toThrow(/introuvable/)
    const directory = mkdtempSync(join(tmpdir(), 'fees-'))
    const broken = join(directory, 'fees.json')
    writeFileSync(broken, '{ pas du json')
    expect(() => loadFeeScheduleFile(broken)).toThrow(/JSON invalide/)
  })
})
