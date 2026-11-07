import type { PrismaClient } from '@prisma/client'

export interface RawInvariants {
  unbalancedEntries: Array<{ entryId: string; total: bigint }>
  cacheMismatches: Array<{ accountId: string; cached: bigint; computed: bigint }>
  negativeBalances: Array<{ accountId: string; balance: bigint }>
  totalsByKind: Map<string, bigint>
}

/** Contrôles d'intégrité par SQL (balayage complet : pour la réconciliation nocturne et les tests, pas pour une requête utilisateur). */
export class InvariantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async collect(): Promise<RawInvariants> {
    const unbalancedEntries = await this.prisma.$queryRaw<Array<{ entryId: string; total: bigint }>>`
      SELECT "entry_id" AS "entryId", SUM("amount")::bigint AS "total"
      FROM "postings"
      GROUP BY "entry_id"
      HAVING SUM("amount") <> 0`

    const cacheMismatches = await this.prisma.$queryRaw<
      Array<{ accountId: string; cached: bigint; computed: bigint }>
    >`
      SELECT a."id" AS "accountId", a."balance" AS "cached", COALESCE(SUM(p."amount"), 0)::bigint AS "computed"
      FROM "ledger_accounts" a
      LEFT JOIN "postings" p ON p."account_id" = a."id"
      GROUP BY a."id", a."balance"
      HAVING a."balance" <> COALESCE(SUM(p."amount"), 0)`

    const negativeBalances = await this.prisma.$queryRaw<Array<{ accountId: string; balance: bigint }>>`
      SELECT "id" AS "accountId", "balance"
      FROM "ledger_accounts"
      WHERE NOT "allows_negative" AND "balance" < 0`

    const byKind = await this.prisma.$queryRaw<Array<{ kind: string; total: bigint }>>`
      SELECT "kind"::text AS "kind", COALESCE(SUM("balance"), 0)::bigint AS "total"
      FROM "ledger_accounts"
      GROUP BY "kind"`

    return {
      unbalancedEntries,
      cacheMismatches,
      negativeBalances,
      totalsByKind: new Map(byKind.map((row) => [row.kind, row.total] as const)),
    }
  }
}
