import { argon2, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

// Runs at most `max` tasks at once; the rest wait in order. A finishing task hands its slot
// straight to the next waiter, so the limit holds even between microtasks.
export function limitConcurrency(max: number) {
  let running = 0
  const waiting: (() => void)[] = []
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running < max) {
      running++
    } else {
      await new Promise<void>((resolve) => waiting.push(resolve))
    }
    try {
      return await task()
    } finally {
      const next = waiting.shift()
      if (next) {
        next()
      } else {
        running--
      }
    }
  }
}

const argon2Async = promisify(argon2)
// Each hash takes 64 MiB, so a burst of logins must queue instead of exhausting memory.
const runHash = limitConcurrency(4)

export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 256

// RFC 9106 second recommended option: 64 MiB, 3 passes.
const PARAMS = { memory: 65536, passes: 3, parallelism: 4, tagLength: 32 }

const b64 = (buffer: Buffer) => buffer.toString('base64').replace(/=+$/, '')

// Stored in PHC string format, so the parameters can change without breaking old hashes.
export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16)
  const hash = await runHash(() => argon2Async('argon2id', { ...PARAMS, message: password, nonce }))
  const { memory, passes, parallelism } = PARAMS
  return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${b64(nonce)}$${b64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, algorithm, , params, nonce, hash] = stored.split('$')
  const match = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(params ?? '')
  if (algorithm !== 'argon2id' || !match || !nonce || !hash) {
    return false
  }
  const expected = Buffer.from(hash, 'base64')
  const actual = await runHash(() =>
    argon2Async('argon2id', {
      message: password,
      nonce: Buffer.from(nonce, 'base64'),
      memory: Number(match[1]),
      passes: Number(match[2]),
      parallelism: Number(match[3]),
      tagLength: expected.length,
    }),
  )
  return timingSafeEqual(actual, expected)
}

export const newToken = () => randomBytes(32).toString('base64url')

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function tokensEqual(a: string | undefined, b: string): boolean {
  if (a === undefined) {
    return false
  }
  const [x, y] = [Buffer.from(a), Buffer.from(b)]
  return x.length === y.length && timingSafeEqual(x, y)
}

export const USERNAME_PATTERN = /^[a-z0-9_-]{3,30}$/

export const normalizeUsername = (username: string) => username.trim().toLowerCase()
