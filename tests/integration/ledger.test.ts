import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import * as fc from 'fast-check'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_UNIT_OF_WORK_SETTINGS,
  PrismaTransactionRunner,
  UnitOfWork,
} from '../../app/core/database/unit_of_work.js'
import { createLogger } from '../../app/core/logger/logger.js'
import { Money } from '../../app/core/money/money.js'
import { systemClock } from '../../app/core/support/clock.js'
import { LedgerError } from '../../app/modules/ledger/exceptions/ledger_error.js'
import { buildLedger } from '../../app/modules/ledger/provider.js'
import type { LedgerService } from '../../app/modules/ledger/services/ledger_service.js'
import { parseFeeSchedule } from '../../app/modules/payments/models/fee_schedule.js'
import { FeeCalculator } from '../../app/modules/payments/services/fee_calculator.js'
import { INTEGRATION, requireEnv } from '../helpers/integration.js'

// Nécessite PostgreSQL migré (RUN_INTEGRATION=1 et DATABASE_URL). Ignoré sinon.
// Le ledger est immuable : les tests ne nettoient rien et utilisent des comptes neufs (propriétaires aléatoires).
describe.skipIf(!INTEGRATION)('intégration ledger (PostgreSQL)', () => {
  let prisma: PrismaClient
  let uow: UnitOfWork
  let ledger: LedgerService
  let external: string
  let transit: string
  let feesMesomb: string
  let feesApp: string

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: requireEnv('DATABASE_URL') })
    await prisma.$connect()
    // Davantage de tentatives que la production : le test de concurrence sature volontairement un compte.
    uow = new UnitOfWork(
      new PrismaTransactionRunner(prisma),
      { ...DEFAULT_UNIT_OF_WORK_SETTINGS, maxAttempts: 10 },
      { logger: createLogger({ level: 'silent' }) },
    )
    ledger = buildLedger({ prisma, uow, clock: systemClock })
    external = await ledger.systemAccountId('EXTERNAL')
    transit = await ledger.systemAccountId('TRANSIT')
    feesMesomb = await ledger.systemAccountId('FEES_MESOMB')
    feesApp = await ledger.systemAccountId('FEES_APP')
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  const newWallet = () => ledger.openAccount({ kind: 'USER_WALLET', ownerUserId: randomUUID() })
  const newGoal = () => ledger.openAccount({ kind: 'USER_GOAL', ownerUserId: randomUUID() })

  const topup = (accountId: string, amount: number, key: string = randomUUID()) =>
    ledger.post({
      kind: 'TOPUP',
      idempotencyKey: key,
      postings: [
        { accountId: external, amount: Money.of(-amount) },
        { accountId, amount: Money.of(amount) },
      ],
    })

  const transfer = (from: string, to: string, amount: number, key: string = randomUUID()) =>
    ledger.post({
      kind: 'TRANSFER',
      idempotencyKey: key,
      postings: [
        { accountId: from, amount: Money.of(-amount) },
        { accountId: to, amount: Money.of(amount) },
      ],
    })

  const balance = async (accountId: string): Promise<bigint> => (await ledger.balanceOf(accountId)).value

  async function codeOf(operation: Promise<unknown>): Promise<string | null> {
    try {
      await operation
    } catch (error) {
      if (error instanceof LedgerError) {
        return error.code
      }
      throw error
    }
    return null
  }

  describe('comptes système et comptes utilisateur', () => {
    it('expose les comptes système créés par la migration', async () => {
      expect((await ledger.getAccount(external)).allowsNegative).toBe(true)
      expect((await ledger.getAccount(transit)).allowsNegative).toBe(false)
      expect((await ledger.getAccount(feesApp)).kind).toBe('SYSTEM_FEES_APP')
      expect((await ledger.getAccount(await ledger.systemAccountId('SUSPENSE'))).allowsNegative).toBe(true)
    })

    it('ouvre un compte à zéro et n\'autorise qu\'un wallet par utilisateur', async () => {
      const owner = randomUUID()
      const wallet = await ledger.openAccount({ kind: 'USER_WALLET', ownerUserId: owner })
      expect(wallet.balance.isZero()).toBe(true)
      expect(wallet.status).toBe('ACTIVE')
      expect(await codeOf(ledger.openAccount({ kind: 'USER_WALLET', ownerUserId: owner }))).toBe('ledger_account_exists')
      await ledger.openAccount({ kind: 'USER_ENVELOPE', ownerUserId: owner })
      await ledger.openAccount({ kind: 'USER_ENVELOPE', ownerUserId: owner })
      expect(await ledger.accountsOf(owner)).toHaveLength(3)
    })
  })

  describe('écritures', () => {
    it('recharge un wallet et débite le compte EXTERNAL du même montant', async () => {
      const wallet = await newWallet()
      const externalBefore = await balance(external)
      const entry = await topup(wallet.id, 1_000)

      expect(await balance(wallet.id)).toBe(1_000n)
      expect(await balance(external)).toBe(externalBefore - 1_000n)
      expect(entry.postings.map((posting) => posting.balanceAfter.value).sort()).toEqual(
        [externalBefore - 1_000n, 1_000n].sort(),
      )
    })

    it('refuse un solde insuffisant sans rien écrire', async () => {
      const wallet = await newWallet()
      const other = await newWallet()
      await topup(wallet.id, 100)
      const key = randomUUID()

      expect(await codeOf(transfer(wallet.id, other.id, 101, key))).toBe('ledger_insufficient_funds')
      expect(await balance(wallet.id)).toBe(100n)
      expect(await balance(other.id)).toBe(0n)
      expect(await prisma.journalEntry.findUnique({ where: { idempotencyKey: key } })).toBeNull()
    })

    it('refuse une écriture déséquilibrée et un compte inconnu', async () => {
      const wallet = await newWallet()
      const unbalanced = ledger.post({
        kind: 'ADJUSTMENT',
        idempotencyKey: randomUUID(),
        postings: [
          { accountId: external, amount: Money.of(-50) },
          { accountId: wallet.id, amount: Money.of(100) },
        ],
      })
      expect(await codeOf(unbalanced)).toBe('ledger_unbalanced_entry')
      expect(await codeOf(topup(randomUUID(), 10))).toBe('ledger_account_not_found')
    })

    it('est idempotent : même clé et même contenu = même écriture, contenu différent = conflit', async () => {
      const wallet = await newWallet()
      const key = randomUUID()
      const first = await topup(wallet.id, 1_000, key)
      const second = await topup(wallet.id, 1_000, key)

      expect(second.id).toBe(first.id)
      expect(await balance(wallet.id)).toBe(1_000n)
      expect(await codeOf(topup(wallet.id, 2_000, key))).toBe('ledger_idempotency_conflict')
      expect(await balance(wallet.id)).toBe(1_000n)
    })

    it('n\'applique qu\'une seule fois une écriture rejouée en parallèle', async () => {
      const wallet = await newWallet()
      const key = randomUUID()
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => topup(wallet.id, 700, key)))

      const ids = new Set<string>()
      for (const result of results) {
        if (result.status === 'fulfilled') {
          ids.add(result.value.id)
        } else {
          // Un doublon concurrent peut être refusé (409) : le client réessaie et obtient l\'écriture existante.
          expect(result.reason).toBeInstanceOf(LedgerError)
          expect((result.reason as LedgerError).code).toBe('ledger_idempotency_conflict')
        }
      }
      expect(ids.size).toBe(1)
      expect(await balance(wallet.id)).toBe(700n)
    })

    it('partage la transaction de l\'appelant : annulée avec elle', async () => {
      const wallet = await newWallet()
      await expect(
        uow.run(async (tx) => {
          await ledger.post(
            {
              kind: 'TOPUP',
              idempotencyKey: randomUUID(),
              postings: [
                { accountId: external, amount: Money.of(-300) },
                { accountId: wallet.id, amount: Money.of(300) },
              ],
            },
            { tx },
          )
          throw new Error('annulation voulue')
        }),
      ).rejects.toThrow('annulation voulue')
      expect(await balance(wallet.id)).toBe(0n)
    })
  })

  describe('frais supportés par l\'utilisateur', () => {
    const calculator = new FeeCalculator(
      parseFeeSchedule({
        version: 1,
        currency: 'XAF',
        appFee: { bps: 50, appliesTo: ['COLLECT', 'PAYOUT'] },
        mesomb: {
          CM: {
            MTN_MOMO: {
              COLLECT: { enabled: true, verified: true, tiers: [{ upTo: null, fixed: '100', bps: 0 }] },
              PAYOUT: { enabled: true, verified: true, tiers: [{ upTo: null, fixed: '150', bps: 100 }] },
            },
          },
        },
      }),
    )

    it('recharge : le wallet reçoit le montant moins les frais, qui alimentent les comptes de frais', async () => {
      const wallet = await newWallet()
      const fees = calculator.quote({ operation: 'COLLECT', country: 'CM', provider: 'MTN_MOMO', amount: Money.of(10_000) })
      const feesMesombBefore = await balance(feesMesomb)
      const feesAppBefore = await balance(feesApp)

      await ledger.post({
        kind: 'TOPUP',
        idempotencyKey: randomUUID(),
        postings: [
          { accountId: external, amount: Money.of(-10_000) },
          { accountId: wallet.id, amount: fees.walletDelta },
          { accountId: feesMesomb, amount: fees.mesombFee },
          { accountId: feesApp, amount: fees.appFee },
        ],
      })

      expect(await balance(wallet.id)).toBe(10_000n - fees.totalFees.value)
      expect(await balance(feesMesomb)).toBe(feesMesombBefore + 100n)
      expect(await balance(feesApp)).toBe(feesAppBefore + 50n)
    })

    it('envoi : le wallet est débité du montant + frais, le montant part en transit', async () => {
      const wallet = await newWallet()
      await topup(wallet.id, 20_000)
      const fees = calculator.quote({ operation: 'PAYOUT', country: 'CM', provider: 'MTN_MOMO', amount: Money.of(10_000) })
      const transitBefore = await balance(transit)

      await ledger.post({
        kind: 'PAYOUT_RESERVE',
        idempotencyKey: randomUUID(),
        postings: [
          { accountId: wallet.id, amount: fees.walletDelta },
          { accountId: transit, amount: fees.amount },
          { accountId: feesMesomb, amount: fees.mesombFee },
          { accountId: feesApp, amount: fees.appFee },
        ],
      })

      expect(await balance(wallet.id)).toBe(20_000n + fees.walletDelta.value)
      expect(await balance(transit)).toBe(transitBefore + 10_000n)
    })
  })

  describe('contre-passation', () => {
    it('restaure les soldes, une seule fois, et ne se contre-passe pas elle-même', async () => {
      const a = await newWallet()
      const b = await newWallet()
      await topup(a.id, 1_000)
      const original = await transfer(a.id, b.id, 400)

      const reversal = await ledger.reverse(original.id, { reason: 'erreur de saisie' })
      expect(reversal.kind).toBe('REVERSAL')
      expect(reversal.reversesEntryId).toBe(original.id)
      expect(await balance(a.id)).toBe(1_000n)
      expect(await balance(b.id)).toBe(0n)

      expect((await ledger.reverse(original.id)).id).toBe(reversal.id)
      expect(await codeOf(ledger.reverse(reversal.id))).toBe('ledger_reversal_not_allowed')
      expect(await codeOf(ledger.reverse(randomUUID()))).toBe('ledger_entry_not_found')
    })

    it('est refusée si un solde deviendrait négatif', async () => {
      const a = await newWallet()
      const b = await newWallet()
      const c = await newWallet()
      await topup(a.id, 1_000)
      const original = await transfer(a.id, b.id, 400)
      await transfer(b.id, c.id, 400) // les fonds ont été dépensés

      expect(await codeOf(ledger.reverse(original.id))).toBe('ledger_reversal_would_overdraw')
      expect(await balance(a.id)).toBe(600n)
      expect(await balance(b.id)).toBe(0n)
    })
  })

  describe('statut des comptes', () => {
    it('un objectif gelé accepte les crédits mais refuse les débits jusqu\'au dégel', async () => {
      const wallet = await newWallet()
      const goal = await newGoal()
      await topup(wallet.id, 1_000)
      await ledger.freezeAccount(goal.id)

      await transfer(wallet.id, goal.id, 600)
      expect(await balance(goal.id)).toBe(600n)
      expect(await codeOf(transfer(goal.id, wallet.id, 100))).toBe('ledger_account_frozen')

      await ledger.unfreezeAccount(goal.id)
      await transfer(goal.id, wallet.id, 100)
      expect(await balance(goal.id)).toBe(500n)
    })

    it('ne ferme qu\'un compte vide, et un compte fermé refuse toute écriture', async () => {
      const wallet = await newWallet()
      const goal = await newGoal()
      await topup(wallet.id, 100)
      await transfer(wallet.id, goal.id, 50)

      expect(await codeOf(ledger.closeAccount(goal.id))).toBe('ledger_account_not_empty')
      await transfer(goal.id, wallet.id, 50)
      expect((await ledger.closeAccount(goal.id)).status).toBe('CLOSED')
      expect(await codeOf(transfer(wallet.id, goal.id, 10))).toBe('ledger_account_closed')
    })
  })

  describe('historique', () => {
    it('pagine par curseur, du plus récent au plus ancien, avec le solde après chaque ligne', async () => {
      const wallet = await newWallet()
      for (const amount of [100, 200, 300, 400, 500]) {
        await topup(wallet.id, amount)
      }

      const collected: Array<{ amount: string; balanceAfter: string }> = []
      let cursor: string | undefined
      let pages = 0
      do {
        const page = await ledger.history(wallet.id, { limit: 2, ...(cursor === undefined ? {} : { cursor }) })
        collected.push(...page.items.map((item) => ({ amount: item.amount.toString(), balanceAfter: item.balanceAfter.toString() })))
        cursor = page.nextCursor ?? undefined
        pages++
      } while (cursor !== undefined)

      expect(pages).toBe(3)
      expect(collected).toEqual([
        { amount: '500', balanceAfter: '1500' },
        { amount: '400', balanceAfter: '1000' },
        { amount: '300', balanceAfter: '600' },
        { amount: '200', balanceAfter: '300' },
        { amount: '100', balanceAfter: '100' },
      ])
      expect(await codeOf(ledger.history(wallet.id, { cursor: 'abc' }))).toBe('ledger_invalid_entry')
    })
  })

  describe('garde-fous SQL (même en contournant le code applicatif)', () => {
    it('refuse en base une écriture déséquilibrée au commit', async () => {
      const wallet = await newWallet()
      const entryId = randomUUID()
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`INSERT INTO "journal_entries" ("id", "kind", "idempotency_key", "occurred_at") VALUES (${entryId}::uuid, 'TRANSFER'::"JournalEntryKind", ${randomUUID()}, now())`
          await tx.$executeRaw`INSERT INTO "postings" ("id", "entry_id", "account_id", "line_no", "amount") VALUES (gen_random_uuid(), ${entryId}::uuid, ${wallet.id}::uuid, 1, 100)`
          await tx.$executeRaw`INSERT INTO "postings" ("id", "entry_id", "account_id", "line_no", "amount") VALUES (gen_random_uuid(), ${entryId}::uuid, ${external}::uuid, 2, -50)`
        }),
      ).rejects.toThrow()

      expect(await prisma.journalEntry.findUnique({ where: { id: entryId } })).toBeNull()
      expect(await balance(wallet.id)).toBe(0n)
    })

    it('refuse en base un débit au-delà du solde', async () => {
      const wallet = await newWallet()
      const entryId = randomUUID()
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`INSERT INTO "journal_entries" ("id", "kind", "idempotency_key", "occurred_at") VALUES (${entryId}::uuid, 'TRANSFER'::"JournalEntryKind", ${randomUUID()}, now())`
          await tx.$executeRaw`INSERT INTO "postings" ("id", "entry_id", "account_id", "line_no", "amount") VALUES (gen_random_uuid(), ${entryId}::uuid, ${wallet.id}::uuid, 1, -100)`
          await tx.$executeRaw`INSERT INTO "postings" ("id", "entry_id", "account_id", "line_no", "amount") VALUES (gen_random_uuid(), ${entryId}::uuid, ${external}::uuid, 2, 100)`
        }),
      ).rejects.toThrow(/solde insuffisant/)
    })

    it('interdit de modifier ou supprimer une écriture, et de toucher directement à un solde', async () => {
      const wallet = await newWallet()
      const entry = await topup(wallet.id, 500)
      const postingId = entry.postings[0]?.id ?? ''

      await expect(prisma.posting.update({ where: { id: postingId }, data: { amount: 1n } })).rejects.toThrow()
      await expect(prisma.journalEntry.delete({ where: { id: entry.id } })).rejects.toThrow()
      await expect(
        prisma.$executeRaw`UPDATE "ledger_accounts" SET "balance" = 5 WHERE "id" = ${wallet.id}::uuid`,
      ).rejects.toThrow()
      await expect(
        prisma.$executeRaw`DELETE FROM "ledger_accounts" WHERE "id" = ${wallet.id}::uuid`,
      ).rejects.toThrow()
      expect(await balance(wallet.id)).toBe(500n)
    })
  })

  describe('concurrence', () => {
    it('dix débits simultanés de 300 sur un solde de 1000 : exactement trois réussissent', async () => {
      const source = await newWallet()
      const target = await newWallet()
      await topup(source.id, 1_000)

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => transfer(source.id, target.id, 300)),
      )
      const fulfilled = results.filter((result) => result.status === 'fulfilled')
      for (const result of results) {
        if (result.status === 'rejected') {
          expect(result.reason).toBeInstanceOf(LedgerError)
          expect((result.reason as LedgerError).code).toBe('ledger_insufficient_funds')
        }
      }

      expect(fulfilled).toHaveLength(3)
      expect(await balance(source.id)).toBe(100n)
      expect(await balance(target.id)).toBe(900n)
    })
  })

  describe('invariants et propriétés', () => {
    it('propriétés : modèle exact, conservation du total, aucun solde négatif', async () => {
      const operation = fc.record({
        from: fc.integer({ min: 0, max: 3 }),
        to: fc.integer({ min: 0, max: 3 }),
        amount: fc.integer({ min: 1, max: 700 }),
      })

      await fc.assert(
        fc.asyncProperty(fc.array(operation, { minLength: 1, maxLength: 10 }), async (operations) => {
          const wallets = await Promise.all([0, 1, 2, 3].map(() => newWallet()))
          const ids = wallets.map((wallet) => wallet.id)
          const model = [500, 500, 500, 500]
          for (const id of ids) {
            await topup(id, 500)
          }

          for (const op of operations) {
            const fromId = ids[op.from]
            const toId = ids[op.to]
            if (fromId === undefined || toId === undefined || op.from === op.to) {
              continue
            }
            const funded = (model[op.from] ?? 0) >= op.amount
            expect(await codeOf(transfer(fromId, toId, op.amount))).toBe(
              funded ? null : 'ledger_insufficient_funds',
            )
            if (funded) {
              model[op.from] = (model[op.from] ?? 0) - op.amount
              model[op.to] = (model[op.to] ?? 0) + op.amount
            }
          }

          let total = 0n
          for (const [index, id] of ids.entries()) {
            const actual = await balance(id)
            expect(actual).toBe(BigInt(model[index] ?? 0))
            expect(actual).toBeGreaterThanOrEqual(0n)
            total += actual
          }
          expect(total).toBe(2_000n)
        }),
        { numRuns: 15 },
      )
    }, 90_000)

    it('le contrôle d\'intégrité ne signale aucune violation', async () => {
      const report = await ledger.checkInvariants()
      expect(report.violations).toEqual([])
      expect(report.ok).toBe(true)

      const { totals } = report
      const others = Money.sum([totals.users, totals.feesMesomb, totals.feesApp, totals.transit, totals.suspense])
      expect(totals.expectedMerchantBalance.equals(others)).toBe(true)
    })
  })
})
