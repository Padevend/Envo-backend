import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Analyse statique des imports : frontières de modules, Prisma réservé aux repositories, absence de cycles.
 * Fonctions pures (testables avec des sources fictives) + un chargeur du dépôt réel.
 */

export interface Violation {
  rule: string
  from: string
  to: string
}

export type SourceMap = Readonly<Record<string, string>>

const IMPORT_PATTERN =
  /^[ \t]*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm

export function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2]
    if (specifier !== undefined) {
      specifiers.push(specifier)
    }
  }
  return specifiers
}

/** Résout un import relatif (`./x.js`) vers le chemin du fichier source (`x.ts`), en chemin POSIX relatif à la racine. */
export function resolveImport(fromFile: string, specifier: string): string {
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier))
  return joined.endsWith('.js') ? `${joined.slice(0, -3)}.ts` : joined
}

function moduleOf(file: string): string | undefined {
  return /^app\/modules\/([^/]+)\//.exec(file)?.[1]
}

function checkRelativeImport(file: string, target: string, violations: Violation[]): void {
  if (file.startsWith('app/core/') && target.startsWith('app/modules/')) {
    violations.push({ rule: 'core-independent-of-modules', from: file, to: target })
  }
  if (file.startsWith('app/') && (target.startsWith('start/') || target.startsWith('bin/'))) {
    violations.push({ rule: 'app-not-to-start-or-bin', from: file, to: target })
  }
  const fromModule = moduleOf(file)
  const toModule = moduleOf(target)
  if (
    fromModule !== undefined &&
    toModule !== undefined &&
    fromModule !== toModule &&
    target !== `app/modules/${toModule}/index.ts`
  ) {
    violations.push({ rule: 'module-public-api-only', from: file, to: target })
  }
}

function checkPackageImport(file: string, specifier: string, violations: Violation[]): void {
  const isPrisma = specifier === '@prisma/client' || specifier.startsWith('@prisma/client/')
  const module = moduleOf(file)
  if (isPrisma && module !== undefined && !file.startsWith(`app/modules/${module}/repositories/`)) {
    violations.push({ rule: 'prisma-only-in-repositories', from: file, to: specifier })
  }
}

function findCycles(graph: ReadonlyMap<string, string[]>): Violation[] {
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  const cycles: Violation[] = []

  const visit = (node: string): void => {
    state.set(node, 'visiting')
    stack.push(node)
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) {
        continue
      }
      const nextState = state.get(next)
      if (nextState === 'visiting') {
        const cycle = [...stack.slice(stack.indexOf(next)), next]
        cycles.push({ rule: 'no-circular', from: next, to: cycle.join(' -> ') })
      } else if (nextState === undefined) {
        visit(next)
      }
    }
    stack.pop()
    state.set(node, 'done')
  }

  for (const node of graph.keys()) {
    if (!state.has(node)) {
      visit(node)
    }
  }
  return cycles
}

export function analyzeImports(sources: SourceMap): Violation[] {
  const violations: Violation[] = []
  const graph = new Map<string, string[]>()

  for (const [file, source] of Object.entries(sources)) {
    const edges: string[] = []
    for (const specifier of extractSpecifiers(source)) {
      if (specifier.startsWith('.')) {
        const target = resolveImport(file, specifier)
        edges.push(target)
        checkRelativeImport(file, target, violations)
      } else {
        checkPackageImport(file, specifier, violations)
      }
    }
    graph.set(file, edges)
  }

  return [...violations, ...findCycles(graph)]
}

/** Détecte les imports relatifs qui ne pointent vers aucun fichier connu (fautes de chemin). */
export function findUnresolvedImports(sources: SourceMap): Violation[] {
  const unresolved: Violation[] = []
  for (const [file, source] of Object.entries(sources)) {
    for (const specifier of extractSpecifiers(source)) {
      if (specifier.startsWith('.')) {
        const target = resolveImport(file, specifier)
        if (!(target in sources)) {
          unresolved.push({ rule: 'unresolved-import', from: file, to: target })
        }
      }
    }
  }
  return unresolved
}

const SOURCE_ROOTS = ['app', 'config', 'start', 'bin'] as const
const SOURCE_FILES = ['app.rc.ts'] as const

/** Charge les sources du dépôt (hors tests) : chemins POSIX relatifs à `root`. */
export function loadSources(root: string): Record<string, string> {
  const sources: Record<string, string> = {}

  const walk = (directory: string): void => {
    for (const entry of readdirSync(path.join(root, directory))) {
      const relative = path.posix.join(directory, entry)
      const absolute = path.join(root, relative)
      if (statSync(absolute).isDirectory()) {
        walk(relative)
      } else if (relative.endsWith('.ts') && !relative.endsWith('.test.ts')) {
        sources[relative] = readFileSync(absolute, 'utf8')
      }
    }
  }

  for (const sourceRoot of SOURCE_ROOTS) {
    walk(sourceRoot)
  }
  for (const file of SOURCE_FILES) {
    sources[file] = readFileSync(path.join(root, file), 'utf8')
  }
  return sources
}
