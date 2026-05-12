import { spawnSync } from 'node:child_process'
import {
  assertPlaywrightTestDatabaseUrl,
  composeEnv,
  composeProjectName,
  repositoryRoot,
  testDatabaseUrl,
} from './env'

const composeArgs = ['compose', '-p', composeProjectName]

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

async function waitForComposePostgres(service: string, database: string, env: NodeJS.ProcessEnv) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const result = spawnSync(
      'docker',
      [...composeArgs, 'exec', '-T', service, 'pg_isready', '-U', 'postgres', '-d', database],
      {
        cwd: repositoryRoot,
        env,
        stdio: 'ignore',
      },
    )

    if (result.status === 0) {
      return
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000))
  }

  throw new Error(`Timed out waiting for Docker Compose service "${service}"`)
}

export default async function globalSetup() {
  const databaseUrl = testDatabaseUrl
  assertPlaywrightTestDatabaseUrl(databaseUrl)

  const env = composeEnv({
    DATABASE_URL: databaseUrl,
  })

  if (process.env.E2E_SKIP_DOCKER !== '1') {
    run('docker', [...composeArgs, 'up', '-d', 'postgres_test'], env)
    await waitForComposePostgres('postgres_test', 'web_app_demo_test', env)
  }

  run('bun', ['run', '--cwd', 'backend', 'prisma:deploy'], env)
}
