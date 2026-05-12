import { readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const backendRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

const testFiles = collectTestFiles(resolve(backendRoot, 'src'))
  .filter((file) => file.endsWith('.test.ts') && !file.endsWith('.integration.test.ts'))
  .map((file) => relative(backendRoot, file))
  .sort()

if (testFiles.length === 0) {
  process.stderr.write('No backend unit tests found\n')
  process.exit(1)
}

const result = spawnSync('bun', ['test', ...testFiles], {
  cwd: backendRoot,
  env: process.env,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)

function collectTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectTestFiles(path)
    if (entry.isFile()) return [path]
    return []
  })
}
