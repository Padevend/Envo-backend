import type { Prisma, PrismaClient } from '@prisma/client'
import type { JsonObject } from '../../../core/database/json.js'
import type { Tx } from '../../../core/database/unit_of_work.js'
import { Money } from '../../../core/money/money.js'
import type { HistoryItem, JournalEntry, NewPosting } from '../contracts.js'

type EntryRow = Prisma.JournalEntryGetPayload<{ include: { postings: true } }>

function toEntry(row: EntryRow): JournalEntry {
  return {
    id: row.id,
    kind: row.kind,
    idempotencyKey: row.idempotencyKey,
    externalRef: row.externalRef,
    reversesEntryId: row.reversesEntryId,
    description: row.description,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    postings: [...row.postings]
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((posting) => ({
        id: posting.id,
        seq: posting.seq,
        lineNo: posting.lineNo,
        accountId: posting.accountId,
        amount: Money.of(posting.amount),
        balanceAfter: Money.of(posting.balanceAfter),
      })),
  }
}

export interface InsertEntry {
  kind: JournalEntry['kind']
  idempotencyKey: string
  occurredAt: Date
  postings: readonly NewPosting[]
  externalRef?: string
  reversesEntryId?: string
  description?: string
  metadata?: JsonObject
}

/** Seul endroit qui écrit dans `journal_entries` et `postings`. Les triggers SQL re-vérifient chaque règle. */
export class EntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdempotencyKey(tx: Tx, idempotencyKey: string): Promise<JournalEntry | null> {
    const row = await tx.journalEntry.findUnique({
      where: { idempotencyKey },
      include: { postings: true },
    })
    return row === null ? null : toEntry(row)
  }

  async findById(tx: Tx, id: string): Promise<JournalEntry | null> {
    const row = await tx.journalEntry.findUnique({ where: { id }, include: { postings: true } })
    return row === null ? null : toEntry(row)
  }

  async findReversalOf(tx: Tx, entryId: string): Promise<JournalEntry | null> {
    const row = await tx.journalEntry.findUnique({
      where: { reversesEntryId: entryId },
      include: { postings: true },
    })
    return row === null ? null : toEntry(row)
  }

  async insert(tx: Tx, data: InsertEntry): Promise<JournalEntry> {
    const row = await tx.journalEntry.create({
      data: {
        kind: data.kind,
        idempotencyKey: data.idempotencyKey,
        occurredAt: data.occurredAt,
        ...(data.externalRef === undefined ? {} : { externalRef: data.externalRef }),
        ...(data.reversesEntryId === undefined ? {} : { reversesEntryId: data.reversesEntryId }),
        ...(data.description === undefined ? {} : { description: data.description }),
        ...(data.metadata === undefined ? {} : { metadata: data.metadata }),
        postings: {
          create: data.postings.map((posting, index) => ({
            accountId: posting.accountId,
            lineNo: index + 1,
            amount: posting.amount.value,
          })),
        },
      },
      include: { postings: true },
    })
    return toEntry(row)
  }

  /** Lignes d'un compte, de la plus récente à la plus ancienne, avec `limit + 1` lignes pour détecter la page suivante. */
  async history(accountId: string, cursor: bigint | undefined, limit: number): Promise<HistoryItem[]> {
    const rows = await this.prisma.posting.findMany({
      where: { accountId, ...(cursor === undefined ? {} : { seq: { lt: cursor } }) },
      orderBy: { seq: 'desc' },
      take: limit + 1,
      include: { entry: true },
    })
    return rows.map((row) => ({
      postingId: row.id,
      seq: row.seq,
      entryId: row.entryId,
      kind: row.entry.kind,
      amount: Money.of(row.amount),
      balanceAfter: Money.of(row.balanceAfter),
      occurredAt: row.entry.occurredAt,
      description: row.entry.description,
      externalRef: row.entry.externalRef,
    }))
  }
}
