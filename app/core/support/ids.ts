import { randomUUID } from 'node:crypto'

export interface IdGenerator {
  uuid(): string
}

export const randomIdGenerator: IdGenerator = {
  uuid: () => randomUUID(),
}
