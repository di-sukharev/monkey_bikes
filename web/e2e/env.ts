import {
  defaultBackendPort as hashedDefaultBackendPort,
  defaultWebPort as hashedDefaultWebPort,
  repositoryHash,
  repositoryRoot,
} from './ports'

export { repositoryHash, repositoryRoot } from './ports'

export const defaultBackendPort =
  process.env.E2E_BACKEND_PORT ?? String(hashedDefaultBackendPort)
export const defaultWebPort =
  process.env.E2E_WEB_PORT ?? String(hashedDefaultWebPort)
export const defaultBackendUrl =
  process.env.E2E_BACKEND_URL ?? `http://127.0.0.1:${defaultBackendPort}`
export const defaultWebUrl = process.env.E2E_WEB_URL ?? `http://127.0.0.1:${defaultWebPort}`
export const testDatabaseUrl = requireTestDatabaseUrl()

export function assertPlaywrightTestDatabaseUrl(databaseUrl = testDatabaseUrl) {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '')

  if (!databaseName.endsWith('_test') && process.env.E2E_ALLOW_NON_TEST_DATABASE !== '1') {
    throw new Error(
      `Refusing to run Playwright against non-test database "${databaseName}". Use a *_test database or set E2E_ALLOW_NON_TEST_DATABASE=1 intentionally.`,
    )
  }
}

function requireTestDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.TEST_DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL_TEST must be set in backend/.env or the shell before running web E2E.',
    )
  }

  return databaseUrl
}
