import { PrismaClient } from '@prisma/client'

/** Les repositories sont les seuls à utiliser ce client (règle vérifiée par lint et par test). */
export function createPrismaClient(url: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: url })
}
