import type { Money } from '../../../core/money/money.js'
import type {
  HistoryPage,
  HistoryQuery,
  InvariantReport,
  JournalEntry,
  LedgerAccount,
  LedgerApi,
  LedgerOptions,
  NewEntry,
  OpenAccountInput,
  ReverseOptions,
  SystemAccountCode,
} from '../contracts.js'
import type { AccountService } from './account_service.js'
import type { PostEntryService } from './post_entry_service.js'
import type { ReportService } from './report_service.js'
import type { ReverseEntryService } from './reverse_entry_service.js'

/** Façade : l'API publique du module, qui délègue à un service par responsabilité. */
export class LedgerService implements LedgerApi {
  constructor(
    private readonly poster: PostEntryService,
    private readonly reverser: ReverseEntryService,
    private readonly accounts: AccountService,
    private readonly reports: ReportService,
  ) {}

  post(entry: NewEntry, options?: LedgerOptions): Promise<JournalEntry> {
    return this.poster.post(entry, options)
  }

  reverse(entryId: string, options?: ReverseOptions): Promise<JournalEntry> {
    return this.reverser.reverse(entryId, options)
  }

  balanceOf(accountId: string, options?: LedgerOptions): Promise<Money> {
    return this.reports.balanceOf(accountId, options)
  }

  history(accountId: string, query?: HistoryQuery): Promise<HistoryPage> {
    return this.reports.history(accountId, query)
  }

  getAccount(accountId: string, options?: LedgerOptions): Promise<LedgerAccount> {
    return this.accounts.getAccount(accountId, options)
  }

  accountsOf(ownerUserId: string, options?: LedgerOptions): Promise<LedgerAccount[]> {
    return this.accounts.accountsOf(ownerUserId, options)
  }

  openAccount(input: OpenAccountInput, options?: LedgerOptions): Promise<LedgerAccount> {
    return this.accounts.openAccount(input, options)
  }

  freezeAccount(accountId: string, options?: LedgerOptions): Promise<LedgerAccount> {
    return this.accounts.freeze(accountId, options)
  }

  unfreezeAccount(accountId: string, options?: LedgerOptions): Promise<LedgerAccount> {
    return this.accounts.unfreeze(accountId, options)
  }

  closeAccount(accountId: string, options?: LedgerOptions): Promise<LedgerAccount> {
    return this.accounts.close(accountId, options)
  }

  systemAccountId(code: SystemAccountCode): Promise<string> {
    return this.accounts.systemAccountId(code)
  }

  checkInvariants(): Promise<InvariantReport> {
    return this.reports.checkInvariants()
  }
}
