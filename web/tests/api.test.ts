import { afterEach, expect, test } from 'bun:test'

import { ApiClient } from '../src/lib/api'
import { bootstrapAuthSession } from '../src/lib/bootstrap-auth'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('ApiClient refreshes and retries authenticated requests with the new access token', async () => {
  let accessToken: string | null = 'expired-access-token'
  const calls: Array<{ path: string; authorization: string | null }> = []

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const path = new URL(url).pathname
    const headers = new Headers(init?.headers)
    calls.push({ path, authorization: headers.get('Authorization') })

    const meCallCount = calls.filter((call) => call.path === '/api/auth/me').length

    if (path === '/api/auth/me' && meCallCount === 1) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired access token' } }, 401)
    }

    if (path === '/api/auth/refresh') {
      return json({ accessToken: 'fresh-access-token' }, 200)
    }

    if (path === '/api/auth/me') {
      return json(
        {
          user: {
            id: 'user_1',
            email: 'user@example.com',
            displayName: null,
            role: 'user',
            status: 'active',
            createdAt: '2026-05-11T00:00:00.000Z',
            updatedAt: '2026-05-11T00:00:00.000Z',
          },
        },
        200,
      )
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  const response = await client.me()
  const meCalls = calls.filter((call) => call.path === '/api/auth/me')

  expect(response.user.email).toBe('user@example.com')
  expect(meCalls).toHaveLength(2)
  expect(meCalls[0]?.authorization).toBe('Bearer expired-access-token')
  expect(meCalls[1]?.authorization).toBe('Bearer fresh-access-token')
})

test('ApiClient clears session when refresh fails during an authenticated request', async () => {
  let accessToken: string | null = 'expired-access-token'
  let authExpiredCalls = 0
  const calls: Array<{ path: string; authorization: string | null }> = []

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const path = new URL(url).pathname
    const headers = new Headers(init?.headers)
    calls.push({ path, authorization: headers.get('Authorization') })

    if (path === '/api/auth/me') {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired access token' } }, 401)
    }

    if (path === '/api/auth/refresh') {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } }, 401)
    }

    if (path === '/api/auth/logout') {
      return new Response(null, { status: 204 })
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
    onAuthExpired: () => {
      authExpiredCalls += 1
    },
  })

  await expect(client.me()).rejects.toMatchObject({
    status: 401,
    code: 'UNAUTHORIZED',
  })

  expect(accessToken).toBeNull()
  expect(authExpiredCalls).toBe(1)
  expect(calls.map((call) => call.path)).toEqual([
    '/api/auth/me',
    '/api/auth/refresh',
    '/api/auth/logout',
  ])
})

test('ApiClient expireSession clears stale web session cookie through logout', async () => {
  let accessToken: string | null = 'stale-access-token'
  let authExpiredCalls = 0
  const calls: Array<{ path: string; method: string | undefined }> = []

  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname
    calls.push({ path, method: init?.method })

    if (path === '/api/auth/logout') {
      return new Response(null, { status: 204 })
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
    onAuthExpired: () => {
      authExpiredCalls += 1
    },
  })

  await client.expireSession()

  expect(accessToken).toBeNull()
  expect(authExpiredCalls).toBe(1)
  expect(calls).toEqual([{ path: '/api/auth/logout', method: 'POST' }])
})

test('ApiClient sends admin user patches and parses the updated user', async () => {
  let accessToken: string | null = 'admin-access-token'
  const calls: Array<{ path: string; method: string | undefined; body: unknown }> = []

  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname
    calls.push({
      path,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })

    if (path === '/api/admin/users/user_1') {
      return json(
        {
          user: {
            id: 'user_1',
            email: 'user@example.com',
            displayName: null,
            role: 'manufacturer',
            status: 'active',
            createdAt: '2026-05-11T00:00:00.000Z',
            updatedAt: '2026-05-12T00:00:00.000Z',
          },
        },
        200,
      )
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  const response = await client.updateAdminUser('user_1', { role: 'manufacturer' })

  expect(response.user.role).toBe('manufacturer')
  expect(calls).toEqual([
    {
      path: '/api/admin/users/user_1',
      method: 'PATCH',
      body: { role: 'manufacturer' },
    },
  ])
})

test('ApiClient sends paginated admin user list filters', async () => {
  let accessToken: string | null = 'admin-access-token'
  const calls: Array<{ search: string; authorization: string | null }> = []

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    calls.push({
      search: url.search,
      authorization: headers.get('Authorization'),
    })

    return json(
      {
        items: [],
        page: 2,
        pageSize: 10,
        total: 0,
      },
      200,
    )
  }

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  const response = await client.adminUsers({
    page: 2,
    pageSize: 10,
    role: 'manufacturer',
    status: 'blocked',
  })

  expect(response.page).toBe(2)
  expect(calls).toEqual([
    {
      search: '?page=2&pageSize=10&role=manufacturer&status=blocked',
      authorization: 'Bearer admin-access-token',
    },
  ])
})

test('ApiClient exposes admin user patch errors', async () => {
  let accessToken: string | null = 'admin-access-token'

  globalThis.fetch = async () =>
    json({ error: { code: 'CONFLICT', message: 'At least one active admin is required' } }, 409)

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  await expect(client.updateAdminUser('admin_1', { status: 'blocked' })).rejects.toMatchObject({
    status: 409,
    code: 'CONFLICT',
    message: 'At least one active admin is required',
  })
})

test('bootstrapAuthSession waits for stale-cookie cleanup before completing', async () => {
  const events: string[] = []
  let completed = false
  let finishCleanup!: () => void
  const cleanupFinished = new Promise<void>((resolve) => {
    finishCleanup = resolve
  })

  const bootstrap = bootstrapAuthSession({
    api: {
      refresh: async () => {
        events.push('refresh')
        throw new Error('Invalid refresh token')
      },
      expireSession: async () => {
        events.push('cleanup:start')
        await cleanupFinished
        events.push('cleanup:done')
      },
    },
    shouldApply: () => true,
    setAccessToken: () => {
      events.push('setAccessToken')
    },
  }).then(() => {
    completed = true
  })

  await waitForEvent(events, 'cleanup:start')

  expect(completed).toBe(false)
  expect(events).toEqual(['refresh', 'cleanup:start'])

  finishCleanup()
  await bootstrap

  expect(completed).toBe(true)
  expect(events).toEqual(['refresh', 'cleanup:start', 'cleanup:done'])
})

async function waitForEvent(events: string[], event: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (events.includes(event)) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  throw new Error(`Timed out waiting for event: ${event}`)
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
