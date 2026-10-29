import { hashPassword, limitConcurrency, tokensEqual, verifyPassword } from './credentials'

describe('passwords', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/)
    await expect(verifyPassword('correct horse battery', stored)).resolves.toBe(true)
    await expect(verifyPassword('correct horse battery!', stored)).resolves.toBe(false)
  })

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'))
  })

  it.each(['', 'not-a-hash', '$bcrypt$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA'])(
    'rejects a malformed stored hash %p',
    async (stored) => {
      await expect(verifyPassword('anything', stored)).resolves.toBe(false)
    },
  )
})

describe('tokensEqual', () => {
  it.each([
    ['abc', 'abc', true],
    ['abd', 'abc', false],
    ['ab', 'abc', false],
    [undefined, 'abc', false],
  ])('%p vs %p → %p', (a, b, expected) => {
    expect(tokensEqual(a, b)).toBe(expected)
  })
})

describe('limitConcurrency', () => {
  it('never runs more than the limit at once and finishes every task', async () => {
    const run = limitConcurrency(2)
    let active = 0
    let peak = 0
    const finished: number[] = []
    const task = (id: number) => async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      finished.push(id)
      return id
    }

    const results = await Promise.all([1, 2, 3, 4, 5].map((id) => run(task(id))))
    expect(results).toEqual([1, 2, 3, 4, 5])
    expect(peak).toBe(2)
    expect(finished.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('frees the slot when a task fails', async () => {
    const run = limitConcurrency(1)
    await expect(run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(run(() => Promise.resolve('next'))).resolves.toBe('next')
  })
})
