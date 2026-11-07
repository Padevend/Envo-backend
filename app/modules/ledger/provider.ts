import type { Provider } from '../../core/support/provider.js'
import { AccountRepository } from './repositories/account_repository.js'
import { EntryRepository } from './repositories/entry_repository.js'
import { InvariantRepository } from './repositories/invariant_repository.js'
import { AccountService } from './services/account_service.js'
import { LedgerService } from './services/ledger_service.js'
import { PostEntryService } from './services/post_entry_service.js'
import { ReportService } from './services/report_service.js'
import { ReverseEntryService } from './services/reverse_entry_service.js'

/** Assemble le ledger : à réutiliser tel quel dans les tests d'intégration (`buildLedger`). */
export function buildLedger(deps: {
  prisma: ConstructorParameters<typeof AccountRepository>[0]
  uow: ConstructorParameters<typeof AccountService>[0]['uow']
  clock: ConstructorParameters<typeof ReverseEntryService>[0]['clock']
}): LedgerService {
  const accounts = new AccountRepository(deps.prisma)
  const entries = new EntryRepository(deps.prisma)
  const invariants = new InvariantRepository(deps.prisma)
  const poster = new PostEntryService({ uow: deps.uow, accounts, entries, clock: deps.clock })
  return new LedgerService(
    poster,
    new ReverseEntryService({ uow: deps.uow, entries, poster, clock: deps.clock }),
    new AccountService({ uow: deps.uow, accounts }),
    new ReportService({ accounts, entries, invariants }),
  )
}

const provider: Provider = {
  name: 'ledger',
  register(container) {
    container.bind('ledger', (c) =>
      buildLedger({ prisma: c.make('prisma'), uow: c.make('unitOfWork'), clock: c.make('clock') }),
    )
  },
}

export default provider
