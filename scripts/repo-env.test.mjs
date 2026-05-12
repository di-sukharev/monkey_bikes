import { afterEach, expect, test } from 'bun:test'

import { assertTestDatabaseUrl, testDatabaseUrl } from './repo-env.mjs'

const allowEnvName = 'REPO_ENV_TEST_ALLOW_NON_TEST_DATABASE'

afterEach(() => {
  delete process.env[allowEnvName]
  delete process.env.DATABASE_URL_TEST
  delete process.env.TEST_DATABASE_URL
})

test('testDatabaseUrl prefers project DATABASE_URL_TEST over the compatibility alias', () => {
  process.env.DATABASE_URL_TEST =
    'postgresql://postgres:postgres@localhost:5432/project_database_test?schema=public'
  process.env.TEST_DATABASE_URL =
    'postgresql://postgres:postgres@localhost:5432/compatibility_database_test?schema=public'

  expect(testDatabaseUrl()).toBe(process.env.DATABASE_URL_TEST)
})

test('assertTestDatabaseUrl accepts test database names', () => {
  expect(() =>
    assertTestDatabaseUrl(
      'postgresql://postgres:postgres@localhost:5432/bicycle_monkey_rent_test?schema=public',
      allowEnvName,
    ),
  ).not.toThrow()
})

test('assertTestDatabaseUrl rejects non-test database names by default', () => {
  expect(() =>
    assertTestDatabaseUrl(
      'postgresql://postgres:postgres@localhost:5432/bicycle_monkey_rent?schema=public',
      allowEnvName,
    ),
  ).toThrow(/Refusing to run tests against non-test database/)
})

test('assertTestDatabaseUrl can be intentionally bypassed', () => {
  process.env[allowEnvName] = '1'

  expect(() =>
    assertTestDatabaseUrl(
      'postgresql://postgres:postgres@localhost:5432/bicycle_monkey_rent?schema=public',
      allowEnvName,
    ),
  ).not.toThrow()
})
