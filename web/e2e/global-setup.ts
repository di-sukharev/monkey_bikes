import { spawnSync } from 'node:child_process'
import {
  assertPlaywrightTestDatabaseUrl,
  repositoryRoot,
  testDatabaseUrl,
} from './env'
import { resetE2eDatabase } from './helpers/database'

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
}

export default async function globalSetup() {
  const databaseUrl = testDatabaseUrl
  assertPlaywrightTestDatabaseUrl(databaseUrl)

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DATABASE_URL_TEST: databaseUrl,
  }

  run('bun', ['run', '--cwd', 'backend', 'prisma:deploy'], env)
  await resetE2eDatabase()
}
