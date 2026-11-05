/** Règles de frontières entre modules (doublon volontaire du test d'architecture Vitest, qui reste la référence). */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Aucun cycle de dépendances.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-independent-of-modules',
      severity: 'error',
      comment: "app/core ne dépend d'aucun module.",
      from: { path: '^app/core/' },
      to: { path: '^app/modules/' },
    },
    {
      name: 'app-not-to-start-or-bin',
      severity: 'error',
      comment:
        "Le code applicatif ne dépend pas de la composition (start/) ni des points d'entrée (bin/).",
      from: { path: '^app/' },
      to: { path: '^(start|bin)/' },
    },
    {
      name: 'module-public-api-only',
      severity: 'error',
      comment: "Un module n'importe un autre module que via son index.ts.",
      from: { path: '^app/modules/([^/]+)/' },
      to: {
        path: '^app/modules/([^/]+)/',
        pathNot: ['^app/modules/$1/', '^app/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'prisma-only-in-repositories',
      severity: 'error',
      comment: "Prisma n'est accessible que depuis les repositories.",
      from: { path: '^app/modules/[^/]+/(?!repositories/)' },
      to: { path: 'node_modules/@prisma/client' },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'warn',
      comment:
        "Import non résolu : si cette alerte apparaît sur des imports locaux en '.js', dependency-cruiser ne voit pas ces dépendances et les règles ci-dessus ne protègent rien. Le test Vitest tests/architecture.test.ts reste alors la vérification de référence.",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(node_modules|dist|tests)/' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.js'],
    },
  },
}
