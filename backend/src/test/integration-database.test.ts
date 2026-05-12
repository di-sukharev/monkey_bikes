import { afterEach, expect, test } from 'bun:test'

import { integrationDatabaseUrl } from './integration-database'

const envKeys = [
  'DATABASE_URL_TEST',
  'TEST_DATABASE_URL',
  'TEST_ALLOW_NON_TEST_DATABASE',
] as const
const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof envKeys)[number], string | undefined>

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

test('integrationDatabaseUrl prefers project DATABASE_URL_TEST over compatibility alias', () => {
  process.env.DATABASE_URL_TEST =
    'postgresql://postgres:postgres@localhost:5432/project_database_test?schema=public'
  process.env.TEST_DATABASE_URL =
    'postgresql://postgres:postgres@localhost:5432/compatibility_database_test?schema=public'

  expect(integrationDatabaseUrl()).toBe(process.env.DATABASE_URL_TEST)
})

test('integrationDatabaseUrl rejects direct non-test database runs', () => {
  process.env.DATABASE_URL_TEST =
    'postgresql://postgres:postgres@localhost:5432/bicycle_monkey_rent?schema=public'
  delete process.env.TEST_ALLOW_NON_TEST_DATABASE

  expect(() => integrationDatabaseUrl()).toThrow(/Refusing to run integration tests/)
})
