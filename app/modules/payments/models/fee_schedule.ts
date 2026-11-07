import { z } from 'zod'
import { FEE_OPERATIONS } from '../contracts.js'
import { FeeScheduleError } from '../exceptions/fee_errors.js'
import type { FeeFormula, FeeRounding } from './fee_math.js'

/** Plafond de sécurité des frais de l'application : 1 % par transaction (100 points de base). */
export const APP_FEE_MAX_BPS = 100

const ROUNDINGS = ['CEIL', 'FLOOR', 'HALF_UP'] as const satisfies readonly FeeRounding[]

const amountString = z.string().regex(/^(0|[1-9]\d*)$/, 'entier décimal en XAF attendu, écrit entre guillemets')

const tierSchema = z.strictObject({
  upTo: amountString.nullable(),
  fixed: amountString.default('0'),
  bps: z.number().int().min(0).max(10_000).default(0),
})

const ruleSchema = z
  .strictObject({
    enabled: z.boolean(),
    verified: z.boolean().default(false),
    note: z.string().max(500).optional(),
    tiers: z.array(tierSchema).min(1),
    min: amountString.default('0'),
    max: amountString.nullable().default(null),
    rounding: z.enum(ROUNDINGS).default('CEIL'),
  })
  .superRefine((rule, ctx) => {
    let previous = -1n
    rule.tiers.forEach((tier, index) => {
      const isLast = index === rule.tiers.length - 1
      if (tier.upTo === null) {
        if (!isLast) {
          ctx.addIssue({
            code: 'custom',
            path: ['tiers', index, 'upTo'],
            message: 'seul le dernier palier peut être ouvert (upTo: null)',
          })
        }
        return
      }
      if (isLast) {
        ctx.addIssue({
          code: 'custom',
          path: ['tiers', index, 'upTo'],
          message: 'le dernier palier doit être ouvert (upTo: null)',
        })
      }
      const bound = BigInt(tier.upTo)
      if (bound <= previous) {
        ctx.addIssue({
          code: 'custom',
          path: ['tiers', index, 'upTo'],
          message: 'les paliers doivent être strictement croissants',
        })
      }
      previous = bound
    })
    if (rule.max !== null && BigInt(rule.max) < BigInt(rule.min)) {
      ctx.addIssue({ code: 'custom', path: ['max'], message: 'max doit être supérieur ou égal à min' })
    }
  })

const appFeeSchema = z
  .strictObject({
    bps: z
      .number()
      .int()
      .min(0)
      .max(APP_FEE_MAX_BPS, `les frais de l'application sont plafonnés à ${APP_FEE_MAX_BPS} points de base (1 %)`),
    min: amountString.default('0'),
    max: amountString.nullable().default(null),
    rounding: z.enum(ROUNDINGS).default('HALF_UP'),
    appliesTo: z.array(z.enum(FEE_OPERATIONS)),
  })
  .superRefine((fee, ctx) => {
    if (fee.max !== null && BigInt(fee.max) < BigInt(fee.min)) {
      ctx.addIssue({ code: 'custom', path: ['max'], message: 'max doit être supérieur ou égal à min' })
    }
  })

const providerSchema = z.strictObject({
  COLLECT: ruleSchema.optional(),
  PAYOUT: ruleSchema.optional(),
})

/** Schéma de config/fees.json (voir docs/fees.md). Pays = code ISO alpha-2, moyen de paiement = identifiant libre en majuscules. */
export const feeScheduleFileSchema = z.strictObject({
  version: z.literal(1),
  currency: z.literal('XAF'),
  comment: z.string().optional(),
  appFee: appFeeSchema,
  mesomb: z.record(
    z.string().regex(/^[A-Z]{2}$/, 'code pays ISO alpha-2 en majuscules attendu'),
    z.record(z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'identifiant en majuscules attendu (ex. MTN_MOMO)'), providerSchema),
  ),
})

export type FeeScheduleFile = z.infer<typeof feeScheduleFileSchema>
export type FeeRuleFile = z.infer<typeof ruleSchema>

export function toFormula(rule: FeeRuleFile): FeeFormula {
  return {
    tiers: rule.tiers.map((tier) => ({
      upTo: tier.upTo === null ? null : BigInt(tier.upTo),
      fixed: BigInt(tier.fixed),
      bps: tier.bps,
    })),
    min: BigInt(rule.min),
    max: rule.max === null ? null : BigInt(rule.max),
    rounding: rule.rounding,
  }
}

/** Valide le contenu du fichier de frais. Le message liste les chemins et les raisons, jamais les valeurs. */
export function parseFeeSchedule(json: unknown): FeeScheduleFile {
  const parsed = feeScheduleFileSchema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `  - ${issue.path.map(String).join('.') || '(racine)'} : ${issue.message}`,
    )
    throw new FeeScheduleError(`Fichier de frais invalide :\n${issues.join('\n')}`)
  }
  return parsed.data
}
