import type { Prisma } from '@prisma/client'

/** Charge utile JSON acceptée par Prisma (colonnes Json). Les modules l'importent d'ici, jamais de @prisma/client. */
export type JsonObject = Prisma.InputJsonObject
