import type { PrismaClient } from '@prisma/client'
import type { Redis } from 'ioredis'

/** Seul endroit du module `system` qui touche aux ressources d'infrastructure. */
export class HealthRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  async pingDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`
  }

  async pingRedis(): Promise<void> {
    const reply = await this.redis.ping()
    if (reply !== 'PONG') {
      throw new Error('Réponse Redis inattendue')
    }
  }
}
