import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const mobileRoot = resolve(scriptDir, '../..')
const authFlowPath = resolve(mobileRoot, '.maestro/flows/auth-smoke.yaml')
const orderFlowPath = resolve(mobileRoot, '.maestro/flows/order-request-smoke.yaml')
const configPath = resolve(mobileRoot, '.maestro/config.yaml')
const reportsRoot = resolve(mobileRoot, '.maestro/reports')
const runId = new Date().toISOString().replace(/[^0-9]/g, '')
const reportDir = resolve(reportsRoot, runId)

const testIds = {
  AUTH_OPEN_BUTTON_ID: 'auth.open-auth-button',
  CATALOG_CREATE_ORDER_BUTTON_ID: 'catalog.create-order-button',
  CATALOG_FIRST_BICYCLE_SELECT_ID: 'catalog.first-bicycle-select',
  CATALOG_SCREEN_ID: 'catalog.screen',
  CATALOG_TAB_ID: 'tabs.catalog',
  DASHBOARD_ID: 'auth.dashboard',
  EMAIL_INPUT_ID: 'auth.email-input',
  LOGOUT_BUTTON_ID: 'auth.logout-button',
  NAME_INPUT_ID: 'auth.name-input',
  ORDER_CONTACT_NAME_INPUT_ID: 'order-request.contact-name-input',
  ORDER_CONTACT_PHONE_INPUT_ID: 'order-request.contact-phone-input',
  ORDER_CREATE_BUTTON_ID: 'order-request.create-button',
  ORDER_DETAIL_SCREEN_ID: 'order-detail.screen',
  ORDER_END_DATE_INPUT_ID: 'order-request.end-date-input',
  ORDER_SAFETY_CHECKBOX_ID: 'order-request.safety-checkbox',
  ORDER_START_DATE_INPUT_ID: 'order-request.start-date-input',
  PASSWORD_INPUT_ID: 'auth.password-input',
  PROFILE_TAB_ID: 'tabs.profile',
  SUBMIT_BUTTON_ID: 'auth.submit-button',
}

const appId = process.env.APP_ID ?? process.env.MAESTRO_APP_ID ?? 'com.dimasukharev.monkeybikes'
const email =
  process.env.E2E_EMAIL ??
  `mobile-e2e-${runId}-${Math.random().toString(36).slice(2, 8)}@example.com`
const displayName = process.env.E2E_DISPLAY_NAME ?? 'Mobile E2E User'
const orderEmail =
  process.env.E2E_ORDER_EMAIL ??
  `mobile-order-e2e-${runId}-${Math.random().toString(36).slice(2, 8)}@example.com`
const orderDisplayName = process.env.E2E_ORDER_DISPLAY_NAME ?? 'Mobile Order E2E User'
const password = process.env.E2E_PASSWORD ?? 'password123'
const orderStartsOn = process.env.E2E_ORDER_STARTS_ON ?? futureDateOnly(14)
const orderEndsOn = process.env.E2E_ORDER_ENDS_ON ?? futureDateOnly(15)
const devClientUrl = resolveDevClientUrl()
const apiHealthUrl =
  process.env.E2E_API_HEALTH_URL ??
  (process.env.EXPO_PUBLIC_API_URL
    ? `${process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')}/health`
    : undefined)

function resolveMaestroBin() {
  if (process.env.MAESTRO_BIN) {
    return process.env.MAESTRO_BIN
  }

  const defaultInstallPath = join(homedir(), '.maestro/bin/maestro')
  const probe = spawnSync(defaultInstallPath, ['--version'], { stdio: 'ignore' })

  if (probe.status === 0) {
    return defaultInstallPath
  }

  return 'maestro'
}

function assertMaestroInstalled(maestroBin) {
  const result = spawnSync(maestroBin, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    process.stderr.write(
      `${[
        'Maestro CLI is not ready for this shell.',
        'Install it with: curl -fsSL "https://get.maestro.mobile.dev" | bash',
        'Make sure Java 17+ is active and ~/.maestro/bin is on PATH, or set MAESTRO_BIN.',
        detail ? `Probe output:\n${detail}` : undefined,
      ]
        .filter(Boolean)
        .join('\n')}\n`,
    )
    process.exit(1)
  }

  process.stdout.write(`Maestro ${result.stdout.trim()}\n`)
}

async function preflightApi() {
  if (process.env.MAESTRO_SKIP_API_PREFLIGHT === '1') {
    return
  }

  if (!apiHealthUrl) {
    process.stdout.write(
      'Skipping API preflight: set E2E_API_HEALTH_URL or EXPO_PUBLIC_API_URL to check backend reachability.\n',
    )
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(apiHealthUrl, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    process.stdout.write(`API preflight passed: ${apiHealthUrl}\n`)
  } catch (error) {
    process.stderr.write(
      `API preflight failed for ${apiHealthUrl}. Set E2E_API_HEALTH_URL to a host-reachable /health URL or MAESTRO_SKIP_API_PREFLIGHT=1 to skip intentionally.\n`,
    )
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  } finally {
    clearTimeout(timeout)
  }
}

async function shouldRunOrderFlow() {
  if (process.env.MAESTRO_SKIP_ORDER_FLOW === '1') {
    process.stdout.write('Skipping order request flow: MAESTRO_SKIP_ORDER_FLOW=1.\n')
    return false
  }

  const apiBaseUrl = resolveApiBaseUrl()
  if (!apiBaseUrl) {
    return requireOrderFlow('Skipping order request flow: set E2E_API_HEALTH_URL or EXPO_PUBLIC_API_URL to discover catalog data.')
  }

  const catalogUrl = `${apiBaseUrl}/api/bicycles?page=1&pageSize=1`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(catalogUrl, { signal: controller.signal })
    if (!response.ok) {
      return requireOrderFlow(`Skipping order request flow: catalog probe returned HTTP ${response.status}.`)
    }

    const body = await response.json()
    const total = typeof body?.total === 'number' ? body.total : 0
    if (total <= 0) {
      return requireOrderFlow('Skipping order request flow: no public bicycles are available in the backend catalog.')
    }

    process.stdout.write(`Order request flow enabled: backend catalog has ${total} public bicycle(s).\n`)
    return true
  } catch (error) {
    return requireOrderFlow(
      `Skipping order request flow: catalog probe failed (${error instanceof Error ? error.message : String(error)}).`,
    )
  } finally {
    clearTimeout(timeout)
  }
}

function requireOrderFlow(message) {
  if (process.env.MAESTRO_REQUIRE_ORDER_FLOW === '1') {
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }

  process.stdout.write(`${message}\n`)
  return false
}

function resolveApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')
  }

  if (!apiHealthUrl) {
    return null
  }

  try {
    const url = new URL(apiHealthUrl)
    if (url.pathname === '/health') {
      url.pathname = ''
      url.search = ''
      url.hash = ''
      return url.toString().replace(/\/$/, '')
    }
    return url.origin
  } catch {
    return null
  }
}

function resolveDevClientUrl() {
  if (process.env.MAESTRO_DEV_CLIENT_URL) {
    return process.env.MAESTRO_DEV_CLIENT_URL
  }

  if (!process.env.MAESTRO_DEV_SERVER_URL) {
    return ''
  }

  return `exp+monkey-bikes://expo-development-client/?url=${encodeURIComponent(
    process.env.MAESTRO_DEV_SERVER_URL,
  )}`
}

function futureDateOnly(offsetDays) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

mkdirSync(reportDir, { recursive: true })

const maestroBin = resolveMaestroBin()
assertMaestroInstalled(maestroBin)
await preflightApi()
const runOrderFlow = await shouldRunOrderFlow()
const device = resolveRequestedDevice()
preflightInstalledApp(device)

const args = []

if (device.id) {
  args.push('--device', device.id)
}

args.push(
  'test',
  '--config',
  configPath,
  '--debug-output',
  resolve(reportDir, 'debug'),
  '--test-output-dir',
  resolve(reportDir, 'artifacts'),
  '-e',
  `APP_ID=${appId}`,
  '-e',
  `E2E_DISPLAY_NAME=${displayName}`,
  '-e',
  `E2E_EMAIL=${email}`,
  '-e',
  `E2E_PASSWORD=${password}`,
  '-e',
  `E2E_ORDER_DISPLAY_NAME=${orderDisplayName}`,
  '-e',
  `E2E_ORDER_EMAIL=${orderEmail}`,
  '-e',
  `E2E_ORDER_STARTS_ON=${orderStartsOn}`,
  '-e',
  `E2E_ORDER_ENDS_ON=${orderEndsOn}`,
  '-e',
  `USE_DEV_CLIENT=${devClientUrl ? 'true' : 'false'}`,
  '-e',
  `USE_STANDALONE_APP=${devClientUrl ? 'false' : 'true'}`,
  '-e',
  `DEV_CLIENT_URL=${devClientUrl}`,
)

for (const [key, value] of Object.entries(testIds)) {
  args.push('-e', `${key}=${value}`)
}

args.push(authFlowPath)

if (runOrderFlow) {
  args.push(orderFlowPath)
}

process.stdout.write(`Running Maestro auth smoke against ${appId}\n`)
if (devClientUrl) {
  process.stdout.write(`Opening Expo development client through ${devClientUrl}\n`)
}
if (runOrderFlow) {
  process.stdout.write('Running Maestro order request smoke because catalog data is available.\n')
}
process.stdout.write(`Report directory: ${reportDir}\n`)

const result = spawnSync(maestroBin, args, {
  cwd: mobileRoot,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)

function resolveRequestedDevice() {
  const requestedDevice = process.env.MAESTRO_DEVICE
  if (!requestedDevice) {
    const bootedIosSimulator = resolveSingleBootedIosSimulator()
    if (bootedIosSimulator) {
      process.stdout.write(`Using booted iOS simulator ${bootedIosSimulator.udid} for Maestro preflight.\n`)
      return { id: bootedIosSimulator.udid, iosSimulator: true }
    }

    return { id: null, iosSimulator: false }
  }

  const simulator = resolveIosSimulator(requestedDevice)
  if (simulator) {
    if (simulator.udid !== requestedDevice) {
      process.stdout.write(`Resolved iOS simulator "${requestedDevice}" to ${simulator.udid}.\n`)
    }
    return { id: simulator.udid, iosSimulator: true }
  }

  return { id: requestedDevice, iosSimulator: false }
}

function resolveIosSimulator(requestedDevice) {
  const devices = listIosSimulators()
  const matches = devices.filter(
    (device) => device.udid === requestedDevice || device.name === requestedDevice,
  )
  return matches.find((device) => device.state === 'Booted') ?? matches[0] ?? null
}

function resolveSingleBootedIosSimulator() {
  const bootedDevices = listIosSimulators().filter((device) => device.state === 'Booted')
  return bootedDevices.length === 1 ? bootedDevices[0] : null
}

function listIosSimulators() {
  const result = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  if (result.status !== 0) {
    return []
  }

  try {
    const parsed = JSON.parse(result.stdout)
    return Object.values(parsed.devices ?? {}).flat()
  } catch {
    return []
  }
}

function preflightInstalledApp(device) {
  if (process.env.MAESTRO_SKIP_APP_PREFLIGHT === '1' || !device.id || !device.iosSimulator) {
    return
  }

  const result = spawnSync('xcrun', ['simctl', 'get_app_container', device.id, appId, 'app'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status === 0) {
    return
  }

  process.stderr.write(
    `${[
      `App ${appId} is not installed on iOS simulator ${device.id}.`,
      'Install an Expo development build before running Maestro.',
      'For iOS simulator, build/install with:',
      '  EXPO_PUBLIC_API_URL=http://127.0.0.1:43180 bunx eas-cli build --profile development-simulator --platform ios',
      'or install an existing .app/.ipa on the simulator, then rerun bun run --cwd mobile e2e:maestro.',
      'Set MAESTRO_SKIP_APP_PREFLIGHT=1 only if you intentionally want Maestro to handle this check.',
    ].join('\n')}\n`,
  )
  process.exit(1)
}
