import type { LedgerAccount as AccountRow, PrismaClient } from '@prisma/client'
import type { Tx } from '../../../core/database/unit_of_work.js'
import { Money } from '../../../core/money/money.js'
import type {
  AccountStatus,
  LedgerAccount,
  SystemAccountCode,
  UserAccountKind,
} from '../contracts.js'
import { ledgerErrors } from '../exceptions/ledger_error.js'
import type { LockedAccount } from '../models/entry_rules.js'

interface LockedRow {
  id: string
  status: string
  allows_negative: boolean
  balance: bigint
}

function toAccount(row: AccountRow): LedgerAccount {
  return {
    id: row.id,
    kind: row.kind,
    code: row.code,
    ownerUserId: row.ownerUserId,
    status: row.status,
    allowsNegative: row.allowsNegative,
    balance: Money.of(row.balance),
    createdAt: row.createdAt,
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
}

export class AccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Verrouille les comptes (`FOR UPDATE`) dans l'ordre des identifiants : deux transactions qui touchent
   * les mêmes comptes les verrouillent dans le même ordre (pas d'interblocage ; si un interblocage survient
   * malgré tout, le UnitOfWork rejoue la transaction).
   */
  async lockByIds(tx: Tx, ids: readonly string[]): Promise<LockedAccount[]> {
    const sorted = [...ids].sort()
    const rows = await tx.$queryRaw<LockedRow[]>`
      SELECT "id", "status"::text AS "status", "allows_negative", "balance"
      FROM "ledger_accounts"
      WHERE "id" = ANY(${sorted}::uuid[])
      ORDER BY "id"
      FOR UPDATE`
    return rows.map((row) => ({
      id: row.id,
      status: row.status as AccountStatus,
      allowsNegative: row.allows_negative,
      balance: row.balance,
    }))
  }

  async findById(id: string, tx?: Tx): Promise<LedgerAccount | null> {
    const row = await (tx ?? this.prisma).ledgerAccount.findUnique({ where: { id } })
    return row === null ? null : toAccount(row)
  }

  async findByOwner(ownerUserId: string, tx?: Tx): Promise<LedgerAccount[]> {
    const rows = await (tx ?? this.prisma).ledgerAccount.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(toAccount)
  }

  async findSystemId(code: SystemAccountCode): Promise<string | null> {
    const row = await this.prisma.ledgerAccount.findUnique({ where: { code }, select: { id: true } })
    return row?.id ?? null
  }

  async create(tx: Tx, input: { kind: UserAccountKind; ownerUserId: string }): Promise<LedgerAccount> {
    try {
      const row = await tx.ledgerAccount.create({
        data: { kind: input.kind, ownerUserId: input.ownerUserId },
      })
      return toAccount(row)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ledgerErrors.accountExists()
      }
      throw error
    }
  }

  async setStatus(tx: Tx, id: string, status: AccountStatus): Promise<LedgerAccount> {
    const row = await tx.ledgerAccount.update({ where: { id }, data: { status } })
    return toAccount(row)
  }
}
