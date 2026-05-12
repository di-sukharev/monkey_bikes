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

test('ApiClient manages the current manufacturer profile', async () => {
  let accessToken: string | null = 'manufacturer-access-token'
  const calls: Array<{ path: string; method: string | undefined; body: unknown }> = []

  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname
    calls.push({
      path,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })

    if (path === '/api/manufacturer/profile' && init?.method === 'PUT') {
      return json({ profile: manufacturerProfileResponse('draft') }, 200)
    }

    if (path === '/api/manufacturer/profile/submit') {
      return json({ profile: manufacturerProfileResponse('moderation') }, 200)
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  const saved = await client.upsertManufacturerProfile(manufacturerProfilePayload('Tiny Bikes'))
  const submitted = await client.submitManufacturerProfile()

  expect(saved.profile.status).toBe('draft')
  expect(submitted.profile.status).toBe('moderation')
  expect(calls).toEqual([
    {
      path: '/api/manufacturer/profile',
      method: 'PUT',
      body: manufacturerProfilePayload('Tiny Bikes'),
    },
    {
      path: '/api/manufacturer/profile/submit',
      method: 'POST',
      body: undefined,
    },
  ])
})

test('ApiClient sends admin manufacturer moderation filters and decisions', async () => {
  let accessToken: string | null = 'admin-access-token'
  const calls: Array<{ path: string; search: string; method: string | undefined; body: unknown }> =
    []

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    calls.push({
      path: url.pathname,
      search: url.search,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })

    if (url.pathname === '/api/admin/manufacturers') {
      return json(
        {
          items: [],
          page: 1,
          pageSize: 10,
          total: 0,
        },
        200,
      )
    }

    if (url.pathname === '/api/admin/manufacturers/manufacturer_1/status') {
      return json({ profile: adminManufacturerProfileResponse('approved') }, 200)
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  const list = await client.adminManufacturers({ status: 'moderation', pageSize: 10 })
  const decision = await client.updateAdminManufacturerStatus('manufacturer_1', {
    status: 'approved',
  })

  expect(list.total).toBe(0)
  expect(decision.profile.status).toBe('approved')
  expect(calls).toEqual([
    {
      path: '/api/admin/manufacturers',
      search: '?page=1&pageSize=10&status=moderation',
      method: 'GET',
      body: undefined,
    },
    {
      path: '/api/admin/manufacturers/manufacturer_1/status',
      search: '',
      method: 'PATCH',
      body: {
        status: 'approved',
      },
    },
  ])
})

test('ApiClient serializes bicycle catalog filters', async () => {
  let accessToken: string | null = null
  const calls: Array<{ path: string; search: string; authorization: string | null }> = []

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    calls.push({
      path: url.pathname,
      search: url.search,
      authorization: headers.get('Authorization'),
    })

    return json(
      {
        items: [publicBicycleResponse()],
        page: 1,
        pageSize: 20,
        total: 1,
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

  const response = await client.publicBicycles({
    sizes: ['S', 'M'],
    minPriceKopecks: 100000,
    maxPriceKopecks: 300000,
    startsOn: '2026-05-20',
    endsOn: '2026-05-21',
  })

  expect(response.items[0]?.title).toBe('Tiny Performer S')
  expect(calls).toEqual([
    {
      path: '/api/bicycles',
      search:
        '?page=1&pageSize=20&sizes=S%2CM&minPriceKopecks=100000&maxPriceKopecks=300000&startsOn=2026-05-20&endsOn=2026-05-21',
      authorization: null,
    },
  ])
})

test('ApiClient manages manufacturer bicycles and admin decisions', async () => {
  let accessToken: string | null = 'bike-access-token'
  const calls: Array<{ path: string; method: string | undefined; body: unknown }> = []

  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname
    calls.push({
      path,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })

    if (path === '/api/manufacturer/bicycles' && init?.method === 'POST') {
      return json({ bicycle: bicycleResponse('draft') }, 200)
    }

    if (path === '/api/manufacturer/bicycles/bike_1/submit') {
      return json({ bicycle: bicycleResponse('moderation') }, 200)
    }

    if (path === '/api/admin/bicycles/bike_1/moderation') {
      return json({ bicycle: adminBicycleResponse('available') }, 200)
    }

    if (path === '/api/admin/bicycles/bike_1/status') {
      return json({ bicycle: adminBicycleResponse('hidden') }, 200)
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  const created = await client.createManufacturerBicycle(bicyclePayload('Tiny Performer S'))
  const submitted = await client.submitManufacturerBicycle('bike_1')
  const approved = await client.moderateAdminBicycle('bike_1', { decision: 'approved' })
  const hidden = await client.updateAdminBicycleStatus('bike_1', { status: 'hidden' })

  expect(created.bicycle.status).toBe('draft')
  expect(submitted.bicycle.status).toBe('moderation')
  expect(approved.bicycle.status).toBe('available')
  expect(hidden.bicycle.status).toBe('hidden')
  expect(calls).toEqual([
    {
      path: '/api/manufacturer/bicycles',
      method: 'POST',
      body: bicyclePayload('Tiny Performer S'),
    },
    {
      path: '/api/manufacturer/bicycles/bike_1/submit',
      method: 'POST',
      body: undefined,
    },
    {
      path: '/api/admin/bicycles/bike_1/moderation',
      method: 'PATCH',
      body: { decision: 'approved' },
    },
    {
      path: '/api/admin/bicycles/bike_1/status',
      method: 'PATCH',
      body: { status: 'hidden' },
    },
  ])
})

test('ApiClient sends manufacturer bicycle pagination filters', async () => {
  let accessToken: string | null = 'manufacturer-access-token'
  const calls: Array<{ path: string; search: string; authorization: string | null }> = []

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    calls.push({
      path: url.pathname,
      search: url.search,
      authorization: headers.get('Authorization'),
    })

    return json(
      {
        items: [bicycleResponse('draft')],
        page: 2,
        pageSize: 20,
        total: 21,
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

  const response = await client.manufacturerBicycles({
    page: 2,
    pageSize: 20,
    status: 'draft',
  })

  expect(response.total).toBe(21)
  expect(calls).toEqual([
    {
      path: '/api/manufacturer/bicycles',
      search: '?page=2&pageSize=20&status=draft',
      authorization: 'Bearer manufacturer-access-token',
    },
  ])
})

test('ApiClient creates and lists rental requests without client money fields', async () => {
  let accessToken: string | null = 'user-access-token'
  const calls: Array<{ path: string; search: string; method: string | undefined; body: unknown }> = []

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    calls.push({
      path: url.pathname,
      search: url.search,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })

    if (url.pathname === '/api/orders' && init?.method === 'POST') {
      return json({ order: orderResponse() }, 201)
    }

    if (url.pathname === '/api/orders') {
      return json(
        {
          items: [orderResponse()],
          page: 1,
          pageSize: 20,
          total: 1,
        },
        200,
      )
    }

    if (url.pathname === '/api/orders/order_1') {
      return json({ order: orderResponse() }, 200)
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  const input = {
    bicycleIds: ['bike_1'],
    startsOn: '2026-05-12',
    endsOn: '2026-05-13',
    fulfillmentType: 'pickup' as const,
    deliveryAddress: null,
    contactName: 'Trainer',
    contactPhone: '+7 999 111-22-33',
    userComment: '',
    safetyAgreementAccepted: true as const,
  }

  const created = await client.createOrder(input)
  const list = await client.orders({ page: 1, pageSize: 20, status: 'request' })
  const detail = await client.order('order_1')

  expect(created.order.totalAmountKopecks).toBe(1000000)
  expect(list.total).toBe(1)
  expect(detail.order.id).toBe('order_1')
  expect(calls).toEqual([
    {
      path: '/api/orders',
      search: '',
      method: 'POST',
      body: {
        ...input,
        userComment: null,
      },
    },
    {
      path: '/api/orders',
      search: '?page=1&pageSize=20&status=request',
      method: 'GET',
      body: undefined,
    },
    {
      path: '/api/orders/order_1',
      search: '',
      method: 'GET',
      body: undefined,
    },
  ])
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

function manufacturerProfilePayload(publicName: string) {
  return {
    legalName: `${publicName} LLC`,
    publicName,
    region: 'Moscow',
    city: 'Moscow',
    phone: '+7 999 000-00-00',
    email: 'maker@example.com',
    description: 'Small bicycles for rehearsals and performances.',
  }
}

function manufacturerProfileResponse(status: 'approved' | 'draft' | 'moderation' | 'rejected' | 'blocked') {
  return {
    id: 'manufacturer_1',
    userId: 'user_1',
    ...manufacturerProfilePayload('Tiny Bikes'),
    status,
    moderationComment: null,
    submittedAt: status === 'draft' ? null : '2026-05-12T10:00:00.000Z',
    reviewedAt: status === 'approved' ? '2026-05-12T11:00:00.000Z' : null,
    createdAt: '2026-05-12T09:00:00.000Z',
    updatedAt: '2026-05-12T10:00:00.000Z',
  }
}

function adminManufacturerProfileResponse(
  status: 'approved' | 'draft' | 'moderation' | 'rejected' | 'blocked',
) {
  return {
    ...manufacturerProfileResponse(status),
    user: {
      id: 'user_1',
      email: 'maker@example.com',
      displayName: 'Maker',
      role: 'manufacturer',
      status: 'active',
      createdAt: '2026-05-12T09:00:00.000Z',
      updatedAt: '2026-05-12T09:00:00.000Z',
    },
  }
}

function bicyclePayload(title: string) {
  return {
    title,
    description: 'Compact bicycle for controlled circus rehearsals.',
    size: 'S',
    photoUrls: ['https://example.com/bike.jpg'],
    pricePerDayKopecks: 250000,
    depositKopecks: 500000,
    region: 'Moscow',
    city: 'Moscow',
    pickupAddress: 'Main storage, door 2',
    deliveryAvailable: true,
    maxLoadKg: 12,
    seatHeightCm: 22,
    frameLengthCm: 40,
    wheelDiameterCm: 16,
    recommendedAnimalDimensions: 'Small trained animals up to 70 cm height',
    safetyNotes: 'Use only with trained handlers and indoor safety mats.',
  }
}

function bicycleResponse(status: 'draft' | 'moderation' | 'available' | 'hidden') {
  return {
    id: 'bike_1',
    manufacturerProfileId: 'manufacturer_1',
    ...bicyclePayload('Tiny Performer S'),
    status,
    moderationComment: null,
    submittedAt: status === 'draft' ? null : '2026-05-12T10:00:00.000Z',
    reviewedAt: status === 'available' || status === 'hidden' ? '2026-05-12T11:00:00.000Z' : null,
    createdAt: '2026-05-12T09:00:00.000Z',
    updatedAt: '2026-05-12T10:00:00.000Z',
  }
}

function publicBicycleResponse() {
  const bicycle = { ...bicycleResponse('available') }
  delete (bicycle as Partial<typeof bicycle>).manufacturerProfileId
  delete (bicycle as Partial<typeof bicycle>).moderationComment
  delete (bicycle as Partial<typeof bicycle>).submittedAt
  delete (bicycle as Partial<typeof bicycle>).reviewedAt

  return {
    ...bicycle,
    manufacturer: manufacturerSummary(),
  }
}

function adminBicycleResponse(status: 'draft' | 'moderation' | 'available' | 'hidden') {
  return {
    ...bicycleResponse(status),
    manufacturer: {
      ...manufacturerSummary(),
      status: 'approved',
    },
  }
}

function manufacturerSummary() {
  return {
    id: 'manufacturer_1',
    publicName: 'Tiny Bikes',
    city: 'Moscow',
    region: 'Moscow',
  }
}

function orderResponse() {
  return {
    id: 'order_1',
    userId: 'user_1',
    status: 'request',
    startsOn: '2026-05-12',
    endsOn: '2026-05-13',
    rentalDays: 2,
    fulfillmentType: 'pickup',
    deliveryAddress: null,
    contactName: 'Trainer',
    contactPhone: '+7 999 111-22-33',
    userComment: null,
    adminComment: null,
    rentalAmountKopecks: 500000,
    depositAmountKopecks: 500000,
    deliveryAmountKopecks: 0,
    totalAmountKopecks: 1000000,
    safetyAgreementAcceptedAt: '2026-05-12T10:00:00.000Z',
    createdAt: '2026-05-12T10:00:00.000Z',
    updatedAt: '2026-05-12T10:00:00.000Z',
    items: [
      {
        id: 'item_1',
        orderId: 'order_1',
        bicycleId: 'bike_1',
        pricePerDaySnapshotKopecks: 250000,
        depositSnapshotKopecks: 500000,
        createdAt: '2026-05-12T10:00:00.000Z',
        bicycle: {
          id: 'bike_1',
          title: 'Tiny Performer S',
          size: 'S',
          city: 'Moscow',
          deliveryAvailable: true,
          pickupAddress: 'Main storage, door 2',
          manufacturer: manufacturerSummary(),
        },
      },
    ],
  }
}
