import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FeeScheduleError } from '../exceptions/fee_errors.js'
import { parseFeeSchedule, type FeeScheduleFile } from '../models/fee_schedule.js'

/** Lit et valide le barème des frais. Appelé au démarrage : un fichier absent ou invalide empêche de démarrer. */
export function loadFeeScheduleFile(filePath: string): FeeScheduleFile {
  let raw: string
  try {
    raw = readFileSync(resolve(filePath), 'utf8')
  } catch {
    throw new FeeScheduleError(`Fichier de frais introuvable ou illisible : ${filePath}`)
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new FeeScheduleError(`Fichier de frais : JSON invalide (${filePath})`)
  }
  return parseFeeSchedule(json)
}
