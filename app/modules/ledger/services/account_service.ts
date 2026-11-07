import type { Tx, Transactional } from '../../../core/database/unit_of_work.js'
import type {
  LedgerAccount,
  LedgerOptions,
  OpenAccountInput,
  SystemAccountCode,
} from '../contracts.js'
import { USER_ACCOUNT_KINDS } from '../contracts.js'
import { ledgerErrors } from '../exceptions/ledger_error.js'
import type { AccountRepository } from '../repositories/account_repository.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AccountServiceDeps {
  uow: Transactional
  accounts: AccountRepository
}

export class AccountService {
  readonly #systemIds = new Map<SystemAccountCode, string>()

  constructor(private readonly deps: AccountServiceDeps) {}

  openAccount(input: OpenAccountInput, options: LedgerOptions = {}): Promise<LedgerAccount> {
    if (!USER_ACCOUNT_KINDS.includes(input.kind) || !UUID_PATTERN.test(input.ownerUserId)) {
      throw ledgerErrors.invalidEntry('Type de compte ou propriétaire invalide.')
    }
    return this.#inTransaction(options, (tx) => this.deps.accounts.create(tx, input))
  }

  freeze(accountId: string, options: LedgerOptions = {}): Promise<LedgerAccount> {
    return this.#changeStatus(accountId, 'FROZEN', options)
  }

  unfreeze(accountId: string, options: LedgerOptions = {}): Promise<LedgerAccount> {
    return this.#changeStatus(accountId, 'ACTIVE', options)
  }

  close(accountId: string, options: LedgerOptions = {}): Promise<LedgerAccount> {
    return this.#inTransaction(options, async (tx) => {
      const locked = await this.#lockOne(tx, accountId)
      if (locked.balance !== 0n) {
        throw ledgerErrors.accountNotEmpty()
      }
      return this.deps.accounts.setStatus(tx, accountId, 'CLOSED')
    })
  }

  async getAccount(accountId: string, options: LedgerOptions = {}): Promise<LedgerAccount> {
    const account = await this.deps.accounts.findById(accountId, options.tx)
    if (account === null) {
      throw ledgerErrors.accountNotFound()
    }
    return account
  }

  accountsOf(ownerUserId: string, options: LedgerOptions = {}): Promise<LedgerAccount[]> {
    return this.deps.accounts.findByOwner(ownerUserId, options.tx)
  }

  async systemAccountId(code: SystemAccountCode): Promise<string> {
    const cached = this.#systemIds.get(code)
    if (cached !== undefined) {
      return cached
    }
    const id = await this.deps.accounts.findSystemId(code)
    if (id === null) {
      throw ledgerErrors.invariantViolation(new Error(`Compte système absent : ${code}`))
    }
    this.#systemIds.set(code, id)
    return id
  }

  #changeStatus(
    accountId: string,
    status: 'ACTIVE' | 'FROZEN',
    options: LedgerOptions,
  ): Promise<LedgerAccount> {
    return this.#inTransaction(options, async (tx) => {
      await this.#lockOne(tx, accountId)
      return this.deps.accounts.setStatus(tx, accountId, status)
    })
  }

  async #lockOne(tx: Tx, accountId: string) {
    const [locked] = await this.deps.accounts.lockByIds(tx, [accountId])
    if (locked === undefined) {
      throw ledgerErrors.accountNotFound()
    }
    if (locked.status === 'CLOSED') {
      throw ledgerErrors.accountClosed()
    }
    return locked
  }

  #inTransaction<T>(options: LedgerOptions, operation: (tx: Tx) => Promise<T>): Promise<T> {
    return options.tx === undefined ? this.deps.uow.run(operation) : operation(options.tx)
  }
}
