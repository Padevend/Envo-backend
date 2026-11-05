import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino'

/** Clés dont la valeur ne doit jamais apparaître dans les logs (PIN, OTP, jetons, numéros, clés). */
const SENSITIVE_KEYS = [
  'pin',
  'newPin',
  'currentPin',
  'otp',
  'otpCode',
  'codeHash',
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'signupToken',
  'signature',
  'authorization',
  'cookie',
  'phone',
  'msisdn',
  'privateKey',
  'rawBody',
] as const

/** Chaque clé est masquée à la racine et jusqu'à deux niveaux d'imbrication (ex. req.headers.authorization). */
export const REDACT_PATHS: string[] = SENSITIVE_KEYS.flatMap((key) => [
  key,
  `*.${key}`,
  `*.*.${key}`,
])

export interface LoggerSettings {
  level: string
  name?: string
}

export function createLogger(settings: LoggerSettings, destination?: DestinationStream): Logger {
  const options: LoggerOptions = {
    level: settings.level,
    base: { service: settings.name ?? 'envo-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  }
  return destination === undefined ? pino(options) : pino(options, destination)
}
