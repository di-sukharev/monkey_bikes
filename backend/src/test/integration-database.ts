export function integrationDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.TEST_DATABASE_URL

  if (!databaseUrl) {
    return undefined
  }

  assertIntegrationDatabaseUrl(databaseUrl)
  return databaseUrl
}

function assertIntegrationDatabaseUrl(databaseUrl: string) {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '')

  if (!databaseName.endsWith('_test') && process.env.TEST_ALLOW_NON_TEST_DATABASE !== '1') {
    throw new Error(
      `Refusing to run integration tests against non-test database "${databaseName}". Use a *_test database or set TEST_ALLOW_NON_TEST_DATABASE=1 intentionally.`,
    )
  }
}
