import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  analyzeImports,
  extractSpecifiers,
  findUnresolvedImports,
  loadSources,
} from './helpers/architecture.js'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

const EXPECTED_MODULES = [
  'admin',
  'audit',
  'auth',
  'ledger',
  'notifications',
  'payments',
  'reconciliation',
  'risk',
  'rules',
  'system',
  'users',
  'wallets',
]

describe('architecture du dépôt', () => {
  const sources = loadSources(repoRoot)

  it('respecte les frontières de modules et ne contient aucun cycle', () => {
    expect(analyzeImports(sources)).toEqual([])
  })

  it('n\'importe que des fichiers qui existent', () => {
    expect(findUnresolvedImports(sources)).toEqual([])
  })

  it('contient les modules prévus, chacun avec son API publique (index.ts)', () => {
    const modules = readdirSync(path.join(repoRoot, 'app/modules')).sort()
    expect(modules).toEqual(EXPECTED_MODULES)
    for (const name of EXPECTED_MODULES) {
      expect(Object.keys(sources)).toContain(`app/modules/${name}/index.ts`)
    }
  })
})

describe('détection des violations (sources fictives)', () => {
  const rules = (sources: Record<string, string>): string[] =>
    analyzeImports(sources).map((violation) => violation.rule)

  it('extrait les imports, y compris multi-lignes, ré-exports et imports dynamiques', () => {
    const source = [
      'import {',
      '  a,',
      '  b,',
      "} from './x.js'",
      "export * from './y.js'",
      "const m = await import('./z.js')",
      "import 'side-effect-pkg'",
    ].join('\n')
    expect(extractSpecifiers(source)).toEqual(['./x.js', './y.js', './z.js', 'side-effect-pkg'])
  })

  it('interdit à core d\'importer un module', () => {
    expect(
      rules({
        'app/core/x.ts': "import { a } from '../modules/ledger/index.js'",
        'app/modules/ledger/index.ts': 'export {}',
      }),
    ).toEqual(['core-independent-of-modules'])
  })

  it('interdit à app d\'importer start ou bin', () => {
    expect(
      rules({
        'app/core/x.ts': "import { a } from '../../start/app.js'",
        'start/app.ts': 'export {}',
      }),
    ).toEqual(['app-not-to-start-or-bin'])
  })

  it('interdit d\'importer autre chose que l\'index d\'un autre module', () => {
    expect(
      rules({
        'app/modules/wallets/services/a.ts': "import { b } from '../../ledger/services/post.js'",
        'app/modules/ledger/services/post.ts': 'export {}',
      }),
    ).toEqual(['module-public-api-only'])
  })

  it('autorise l\'import via l\'index d\'un autre module et entre fichiers d\'un même module', () => {
    expect(
      rules({
        'app/modules/wallets/services/a.ts':
          "import { b } from '../../ledger/index.js'\nimport { c } from '../models/c.js'",
        'app/modules/wallets/models/c.ts': 'export {}',
        'app/modules/ledger/index.ts': 'export {}',
      }),
    ).toEqual([])
  })

  it('réserve Prisma aux repositories', () => {
    const prisma = "import { PrismaClient } from '@prisma/client'"
    expect(rules({ 'app/modules/ledger/services/s.ts': prisma })).toEqual([
      'prisma-only-in-repositories',
    ])
    expect(rules({ 'app/modules/ledger/repositories/r.ts': prisma })).toEqual([])
  })

  it('détecte un cycle', () => {
    expect(
      rules({
        'app/core/a.ts': "import './b.js'",
        'app/core/b.ts': "import './a.js'",
      }),
    ).toEqual(['no-circular'])
  })

  it('signale un import qui ne pointe vers aucun fichier', () => {
    expect(findUnresolvedImports({ 'app/core/a.ts': "import './absent.js'" })).toEqual([
      { rule: 'unresolved-import', from: 'app/core/a.ts', to: 'app/core/absent.ts' },
    ])
  })
})
