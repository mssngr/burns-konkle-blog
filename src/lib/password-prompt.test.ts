import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  dismissPasswordPrompt,
  isPasswordPromptDismissed,
  shouldPromptForPassword,
} from '@/lib/password-prompt'

const base = {
  loading: false,
  signedIn: true,
  hasPassword: false,
  recovering: false,
  pathname: '/burns-konkle-blog/profile/',
  dismissed: false,
}

describe('shouldPromptForPassword', () => {
  test('asks a signed-in user who has no password', () => {
    expect(shouldPromptForPassword(base)).toBe(true)
  })
  test.each([
    ['still loading', { loading: true }],
    ['signed out', { signedIn: false }],
    ['already has a password', { hasPassword: true }],
    ['on the password-reset flow', { recovering: true }],
    ['dismissed this browser session', { dismissed: true }],
    ['on the confirm page', { pathname: '/burns-konkle-blog/confirm/' }],
    ['on the confirm page without a trailing slash', { pathname: '/confirm' }],
  ])('stays quiet when %s', (_name, patch) => {
    expect(shouldPromptForPassword({ ...base, ...patch })).toBe(false)
  })
  test('does not mistake a page that merely contains "confirm"', () => {
    expect(
      shouldPromptForPassword({ ...base, pathname: '/confirmed-guests/' }),
    ).toBe(true)
  })
})

describe('dismissal memory', () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal browser stub for bun
    ;(globalThis as any).sessionStorage = makeStorage()
  })
  afterEach(() => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal browser stub for bun
    delete (globalThis as any).sessionStorage
  })
  test('is not dismissed at first, then is after dismissing', () => {
    expect(isPasswordPromptDismissed()).toBe(false)
    dismissPasswordPrompt()
    expect(isPasswordPromptDismissed()).toBe(true)
  })
  test('survives storage that throws', () => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal browser stub for bun
    ;(globalThis as any).sessionStorage = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    }
    expect(isPasswordPromptDismissed()).toBe(false)
    expect(() => dismissPasswordPrompt()).not.toThrow()
  })
})

function makeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  }
}
