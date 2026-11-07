import type { Provider } from '../../core/support/provider.js'
import { loadFeeScheduleFile } from './repositories/fee_schedule_repository.js'
import { FeeCalculator } from './services/fee_calculator.js'

const provider: Provider = {
  name: 'payments',
  register(container) {
    // Les tests peuvent pré-lier leur propre calculateur. Sinon : chargement immédiat (fail fast).
    if (container.has('feeCalculator')) {
      return
    }
    const { filePath } = container.make('config').fees
    container.bindValue('feeCalculator', new FeeCalculator(loadFeeScheduleFile(filePath)))
  },
}

export default provider
