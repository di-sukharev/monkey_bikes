import { describe, expect, test } from 'bun:test'

import { parseSeedAdminConfig } from './seed-admin-config'

const validSource = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:54329/web_app_demo?schema=public',
  SEED_ADMIN_EMAIL: 'admin@example.com',
  SEED_ADMIN_PASSWORD: 'strong-local-password',
}

describe('seed admin config', () => {
  test('accepts local database config with a non-example password', () => {
    const config = parseSeedAdminConfig(validSource)

    expect(config.SEED_ADMIN_EMAIL).toBe('admin@example.com')
    expect(config.SEED_ADMIN_DISPLAY_NAME).toBe('Local Admin')
    expect(config.SEED_ADMIN_ALLOW_NON_LOCAL).toBe(false)
  })

  test('rejects known insecure example passwords', () => {
    expect(() =>
      parseSeedAdminConfig({
        ...validSource,
        SEED_ADMIN_PASSWORD: 'password123',
      }),
    ).toThrow('known insecure')
  })

  test('rejects non-local databases unless explicitly allowed', () => {
    expect(() =>
      parseSeedAdminConfig({
        ...validSource,
        DATABASE_URL: 'postgresql://postgres:postgres@db.example.com:5432/web_app_demo',
      }),
    ).toThrow('local database')

    const config = parseSeedAdminConfig({
      ...validSource,
      DATABASE_URL: 'postgresql://postgres:postgres@db.example.com:5432/web_app_demo',
      SEED_ADMIN_ALLOW_NON_LOCAL: 'true',
    })

    expect(config.SEED_ADMIN_ALLOW_NON_LOCAL).toBe(true)
  })
})
