#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scratchDir = resolve(repoRoot, '.scratch/deploy')

const targets = new Set(['backend-initial', 'backend-final', 'web', 'landing', 'all'])
const target = process.argv[2]
const knownWeakJwtSecrets = new Set(['replace-with-at-least-32-random-characters'])

if (!targets.has(target)) {
  console.error(`Usage: bun scripts/prepare-do-specs.mjs <${[...targets].join('|')}>`)
  console.error('Required env by target:')
  console.error('  backend-initial: JWT_SECRET')
  console.error('  backend-final: JWT_SECRET, DO_WEB_URL')
  console.error('  web: DO_BACKEND_URL')
  console.error('  landing: DO_WEB_URL')
  console.error('  all: JWT_SECRET, DO_BACKEND_URL, DO_WEB_URL')
  process.exit(1)
}

const env = process.env

await mkdir(scratchDir, { recursive: true })

if (target === 'backend-initial' || target === 'backend-final' || target === 'all') {
  const jwtSecret = requiredEnv('JWT_SECRET')
  assertStrongJwtSecret(jwtSecret)
  const webUrl = target === 'backend-initial' ? 'https://placeholder.invalid' : requiredUrlEnv('DO_WEB_URL')
  await writePreparedSpec('backend-app.yaml.example', 'backend-app.yaml', {
    REPLACE_WITH_AT_LEAST_32_RANDOM_CHARS: jwtSecret,
    'https://REPLACE_WITH_WEB_DEFAULT_INGRESS': webUrl,
  })
}

if (target === 'web' || target === 'all') {
  await writePreparedSpec('web-static-app.yaml.example', 'web-static-app.yaml', {
    'https://REPLACE_WITH_BACKEND_DEFAULT_INGRESS': requiredUrlEnv('DO_BACKEND_URL'),
  })
}

if (target === 'landing' || target === 'all') {
  await writePreparedSpec('landing-static-app.yaml.example', 'landing-static-app.yaml', {
    'https://REPLACE_WITH_WEB_DEFAULT_INGRESS': requiredUrlEnv('DO_WEB_URL'),
  })
}

console.log(`Prepared DigitalOcean specs under ${scratchDir}`)

async function writePreparedSpec(templateName, outputName, replacements) {
  const templatePath = resolve(repoRoot, '.do', templateName)
  const outputPath = resolve(scratchDir, outputName)
  let contents = await readFile(templatePath, 'utf8')

  for (const [placeholder, value] of Object.entries(replacements)) {
    contents = contents.split(placeholder).join(value)
  }

  assertNoPlaceholders(outputName, contents)
  assertNoEmptyYamlValues(outputName, contents)
  await writeFile(outputPath, contents)
}

function requiredEnv(name) {
  const value = env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required and cannot be empty`)
  }

  return value
}

function requiredUrlEnv(name) {
  const value = requiredEnv(name)

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') {
      throw new Error('URL must use https')
    }
    return url.toString().replace(/\/$/, '')
  } catch (error) {
    throw new Error(`${name} must be an absolute https URL: ${error.message}`)
  }
}

function assertMinLength(name, value, minimum) {
  if (value.length < minimum) {
    throw new Error(`${name} must be at least ${minimum} characters`)
  }
}

function assertStrongJwtSecret(value) {
  assertMinLength('JWT_SECRET', value, 32)

  const normalized = value.trim().toLowerCase()
  if (knownWeakJwtSecrets.has(normalized) || new Set(value).size === 1) {
    throw new Error('JWT_SECRET must be a non-placeholder random secret')
  }
}

function assertNoPlaceholders(outputName, contents) {
  const placeholders = contents.match(/REPLACE_WITH_[A-Z0-9_]+/g)

  if (placeholders) {
    throw new Error(`${outputName} still contains placeholders: ${[...new Set(placeholders)].join(', ')}`)
  }
}

function assertNoEmptyYamlValues(outputName, contents) {
  const emptyValueLine = contents
    .split('\n')
    .find((line) => /^\s+value:\s*$/.test(line))

  if (emptyValueLine) {
    throw new Error(`${outputName} contains an empty YAML value line: ${emptyValueLine.trim()}`)
  }
}
