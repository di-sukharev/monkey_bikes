import { describe, expect, test } from 'bun:test'

import { loadEnv } from './env'

describe('loadEnv', () => {
  test('parses defaults and comma-separated origins', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:54329/web_app_demo',
      JWT_SECRET: '12345678901234567890123456789012',
      CORS_ORIGINS: 'http://localhost:43181, http://localhost:43183',
    })

    expect(env.PORT).toBe(43180)
    expect(env.APP_ENV).toBe('development')
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900)
    expect(env.COOKIE_SECURE).toBe(false)
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:43181', 'http://localhost:43183'])
    expect(env.PAYMENT_PROVIDER).toBe('stub')
    expect(env.PAYMENT_STUB_DEV_ENDPOINTS_ENABLED).toBe(true)
    expect(env.PAYMENT_CURRENCY).toBe('RUB')
  })

  test('disables stub payment surfaces in production by default', () => {
    const env = loadEnv({
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:54329/web_app_demo',
      JWT_SECRET: '12345678901234567890123456789012',
    })

    expect(env.PAYMENT_PROVIDER).toBe('disabled')
    expect(env.PAYMENT_STUB_DEV_ENDPOINTS_ENABLED).toBe(false)
  })

  test('rejects known weak JWT secrets in production', () => {
    expect(() =>
      loadEnv({
        APP_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:54329/web_app_demo',
        JWT_SECRET: 'replace-with-at-least-32-random-characters',
      }),
    ).toThrow()

    expect(() =>
      loadEnv({
        APP_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:54329/web_app_demo',
        JWT_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).toThrow()
  })

  test('allows explicit stub provider and dev endpoint config', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:54329/web_app_demo',
      JWT_SECRET: '12345678901234567890123456789012',
      PAYMENT_PROVIDER: 'stub',
      PAYMENT_STUB_DEV_ENDPOINTS_ENABLED: 'true',
    })

    expect(env.APP_ENV).toBe('production')
    expect(env.PAYMENT_PROVIDER).toBe('stub')
    expect(env.PAYMENT_STUB_DEV_ENDPOINTS_ENABLED).toBe(true)
  })
})
