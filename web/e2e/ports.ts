import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { Socket } from 'node:net'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
export const repositoryHash = createHash('sha256').update(repositoryRoot).digest('hex').slice(0, 12)

const backendPortRange = {
  start: 50_000,
  size: 3_000,
}
const webPortRange = {
  start: 56_000,
  size: 3_000,
}

export const defaultBackendPort = portFromHash(repositoryHash.slice(6, 12), backendPortRange)
export const defaultWebPort = portFromHash(repositoryHash.slice(0, 6), webPortRange)

const backendEnvPath = resolve(repositoryRoot, 'backend/.env')
const resolvedPortPlanEnvName = 'BICYCLE_RENT_E2E_PORT_PLAN_RESOLVED'

type PortPlan = {
  backendPort: number
  backendUrl: string
  webPort: number
  webUrl: string
}

export async function resolveE2ePorts(): Promise<PortPlan> {
  const reservedPorts = new Map<number, string>()
  const validateAvailability = process.env[resolvedPortPlanEnvName] !== '1'
  const backendPort = await resolveServicePort({
    serviceName: 'backend',
    portEnvName: 'E2E_BACKEND_PORT',
    urlEnvName: 'E2E_BACKEND_URL',
    defaultPort: defaultBackendPort,
    portRange: backendPortRange,
    reservedPorts,
    validateAvailability,
  })
  const webPort = await resolveServicePort({
    serviceName: 'web',
    portEnvName: 'E2E_WEB_PORT',
    urlEnvName: 'E2E_WEB_URL',
    defaultPort: defaultWebPort,
    portRange: webPortRange,
    reservedPorts,
    validateAvailability,
  })
  const backendUrl = process.env.E2E_BACKEND_URL ?? `http://127.0.0.1:${backendPort}`
  const webUrl = process.env.E2E_WEB_URL ?? `http://127.0.0.1:${webPort}`

  return {
    backendPort,
    backendUrl,
    webPort,
    webUrl,
  }
}

export function loadBackendE2eEnv() {
  const backendEnv = readDotEnvFile(backendEnvPath)
  const keysUsedByWebE2e = ['DATABASE_URL_TEST', 'JWT_SECRET', 'TEST_DATABASE_URL']

  for (const key of keysUsedByWebE2e) {
    if (process.env[key] === undefined && backendEnv[key] !== undefined) {
      process.env[key] = backendEnv[key]
    }
  }
}

export function applyE2ePortEnv(plan: PortPlan) {
  process.env.E2E_BACKEND_PORT = String(plan.backendPort)
  process.env.E2E_WEB_PORT = String(plan.webPort)
  process.env.E2E_BACKEND_URL = plan.backendUrl
  process.env.E2E_WEB_URL = plan.webUrl
  process.env[resolvedPortPlanEnvName] = '1'
}

function readDotEnvFile(path: string) {
  if (!existsSync(path)) return {}

  const values: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key) values[key] = value
  }

  return values
}

async function resolveServicePort(input: {
  serviceName: string
  portEnvName: string
  urlEnvName: string
  defaultPort: number
  portRange: { start: number; size: number }
  reservedPorts: Map<number, string>
  validateAvailability: boolean
}) {
  const urlPort = portFromUrl(process.env[input.urlEnvName], input.urlEnvName)
  const explicitPort =
    process.env[input.portEnvName] === undefined
      ? undefined
      : parsePort(process.env[input.portEnvName], input.portEnvName)

  if (urlPort !== undefined && explicitPort !== undefined && urlPort !== explicitPort) {
    throw new Error(
      `${input.urlEnvName} resolves to port ${urlPort}, but ${input.portEnvName} is ${explicitPort}. Keep them equal or set only one of them.`,
    )
  }

  const port = urlPort ?? explicitPort
  if (port !== undefined) {
    await reserveExplicitPort(
      port,
      input.serviceName,
      input.reservedPorts,
      input.validateAvailability,
    )
    return port
  }

  return resolvePort({
    serviceName: input.serviceName,
    defaultPort: input.defaultPort,
    portRange: input.portRange,
    reservedPorts: input.reservedPorts,
  })
}

async function resolvePort(input: {
  serviceName: string
  defaultPort: number
  portRange: { start: number; size: number }
  reservedPorts: Map<number, string>
}) {
  const defaultOffset = input.defaultPort - input.portRange.start
  for (let offset = 0; offset < input.portRange.size; offset += 1) {
    const candidatePort =
      input.portRange.start + ((defaultOffset + offset) % input.portRange.size)
    if (input.reservedPorts.has(candidatePort)) continue
    if (await isPortAvailable(candidatePort)) {
      input.reservedPorts.set(candidatePort, input.serviceName)
      return candidatePort
    }
  }

  throw new Error(
    `Could not find a free ${input.serviceName} E2E port in ${formatPortRange(input.portRange)}.`,
  )
}

async function reserveExplicitPort(
  port: number,
  serviceName: string,
  reservedPorts: Map<number, string>,
  validateAvailability: boolean,
) {
  const existingServiceName = reservedPorts.get(port)
  if (existingServiceName) {
    throw new Error(
      `E2E ${serviceName} port ${port} is already reserved by ${existingServiceName}. Use different E2E_BACKEND_PORT and E2E_WEB_PORT values.`,
    )
  }

  if (validateAvailability && !(await isPortAvailable(port))) {
    throw new Error(
      `E2E ${serviceName} port ${port} is already in use. Stop that local server or choose another E2E_*_PORT value.`,
    )
  }

  reservedPorts.set(port, serviceName)
}

function portFromHash(hashPart: string, range: { start: number; size: number }) {
  return range.start + (Number.parseInt(hashPart, 16) % range.size)
}

function formatPortRange(range: { start: number; size: number }) {
  return `${range.start}-${range.start + range.size - 1}`
}

function parsePort(value: string, envName: string) {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`${envName} must be a valid TCP port, got "${value}".`)
  }

  return port
}

function portFromUrl(value: string | undefined, envName: string) {
  if (!value) return undefined

  try {
    const url = new URL(value)
    if (url.port) return parsePort(url.port, `${envName} port`)
    if (url.protocol === 'http:') return 80
    if (url.protocol === 'https:') return 443
    if (url.protocol === 'postgresql:') return 5432
    return undefined
  } catch {
    throw new Error(`${envName} must be a valid URL, got "${value}".`)
  }
}

function isPortAvailable(port: number) {
  return new Promise<boolean>((resolveAvailability) => {
    const socket = new Socket()
    socket.setTimeout(500)
    socket.once('connect', () => {
      socket.destroy()
      resolveAvailability(false)
    })
    socket.once('error', (error: NodeJS.ErrnoException) => {
      socket.destroy()
      if (error.code === 'ECONNREFUSED') {
        resolveAvailability(true)
        return
      }

      if (error.code === 'EACCES' || error.code === 'EPERM') {
        resolveAvailability(isPortAvailableByLsof(port))
        return
      }

      resolveAvailability(false)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolveAvailability(true)
    })
    socket.connect(port, '127.0.0.1')
  })
}

function isPortAvailableByLsof(port: number) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    stdio: 'ignore',
  })

  return result.status !== 0
}
