import type { Tx } from '../database/unit_of_work.js'
import type { DeliveryRepository } from './delivery_repository.js'

export class PrismaDeliveryRepository implements DeliveryRepository {
  async tryRecord(tx: Tx, eventId: string, listener: string): Promise<boolean> {
    // INSERT ... ON CONFLICT DO NOTHING : un doublon ne casse pas la transaction (contrairement à un create).
    const { count } = await tx.listenerDelivery.createMany({
      data: [{ eventId, listener }],
      skipDuplicates: true,
    })
    return count === 1
  }
}
