import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'
import { integrationDatabaseUrl } from '../test/integration-database'

const databaseUrl = integrationDatabaseUrl()

const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('order API integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:5173'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
  }
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.authSession.deleteMany()
    await prisma.order.deleteMany()
    await prisma.bicycle.deleteMany()
    await prisma.manufacturerProfile.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('creates a rental request with backend totals and immutable item snapshots', async () => {
    const user = await registerUser('renter@example.com', 'Renter')
    const firstBicycle = await createAvailableBicycle('Snapshot Maker One', {
      title: 'Small Snapshot Bike',
      pricePerDayKopecks: 250000,
      depositKopecks: 500000,
      deliveryAvailable: true,
    })
    const secondBicycle = await createAvailableBicycle('Snapshot Maker Two', {
      title: 'Medium Snapshot Bike',
      size: 'M',
      pricePerDayKopecks: 100000,
      depositKopecks: 200000,
      deliveryAvailable: true,
    })

    const create = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify({
        bicycleIds: [firstBicycle.id, secondBicycle.id],
        startsOn: '2026-05-12',
        endsOn: '2026-05-13',
        fulfillmentType: 'delivery',
        deliveryAddress: 'Circus arena, gate 4',
        contactName: 'Trainer',
        contactPhone: '+7 999 111-22-33',
        userComment: 'Keep the bicycles indoors.',
        safetyAgreementAccepted: true,
      }),
    })
    const createBody = await create.json()

    expect(create.status).toBe(201)
    expect(createBody.order.status).toBe('request')
    expect(createBody.order.rentalDays).toBe(2)
    expect(createBody.order.rentalAmountKopecks).toBe(700000)
    expect(createBody.order.depositAmountKopecks).toBe(700000)
    expect(createBody.order.deliveryAmountKopecks).toBe(0)
    expect(createBody.order.totalAmountKopecks).toBe(1400000)
    expect(createBody.order.safetyAgreementAcceptedAt).toBeString()
    expect(createBody.order.items.map((item: { bicycleId: string }) => item.bicycleId)).toEqual([
      firstBicycle.id,
      secondBicycle.id,
    ])
    expect(createBody.order.items[0].pricePerDaySnapshotKopecks).toBe(250000)
    expect(createBody.order.items[1].depositSnapshotKopecks).toBe(200000)
    expect(createBody.order.items[0].bicycle.title).toBe('Small Snapshot Bike')
    expect(createBody.order.items[0].bicycle.pickupAddress).toBe('Main storage, door 2')
    expect(createBody.order.items[0].bicycle.manufacturer.publicName).toBe('Snapshot Maker One')

    await prisma.bicycle.update({
      where: { id: firstBicycle.id },
      data: {
        title: 'Changed Live Bike',
        city: 'Changed City',
        pickupAddress: 'Changed pickup point',
        deliveryAvailable: false,
        pricePerDayKopecks: 900000,
        depositKopecks: 900000,
        status: 'hidden',
      },
    })
    await prisma.manufacturerProfile.update({
      where: { id: firstBicycle.manufacturerProfileId },
      data: {
        publicName: 'Changed Live Maker',
        region: 'Changed Region',
        city: 'Changed Maker City',
      },
    })

    const detail = await app.request(`/api/orders/${createBody.order.id}`, {
      headers: authHeaders(user.accessToken),
    })
    const detailBody = await detail.json()
    expect(detail.status).toBe(200)
    expect(detailBody.order.rentalAmountKopecks).toBe(700000)
    expect(detailBody.order.depositAmountKopecks).toBe(700000)
    expect(detailBody.order.totalAmountKopecks).toBe(1400000)
    expect(detailBody.order.items[0].pricePerDaySnapshotKopecks).toBe(250000)
    expect(detailBody.order.items[0].depositSnapshotKopecks).toBe(500000)
    expect(detailBody.order.items[0].bicycle.title).toBe('Small Snapshot Bike')
    expect(detailBody.order.items[0].bicycle.city).toBe('Moscow')
    expect(detailBody.order.items[0].bicycle.deliveryAvailable).toBe(true)
    expect(detailBody.order.items[0].bicycle.pickupAddress).toBe('Main storage, door 2')
    expect(detailBody.order.items[0].bicycle.manufacturer).toEqual({
      id: firstBicycle.manufacturerProfileId,
      publicName: 'Snapshot Maker One',
      region: 'Moscow',
      city: 'Moscow',
    })

    const list = await app.request('/api/orders?pageSize=10', {
      headers: authHeaders(user.accessToken),
    })
    const listBody = await list.json()
    expect(list.status).toBe(200)
    expect(listBody.items.map((order: { id: string }) => order.id)).toEqual([
      createBody.order.id,
    ])
  })

  test('rejects invalid requests without creating partial orders', async () => {
    const user = await registerUser('invalid-renter@example.com', 'Renter')
    const availableBicycle = await createAvailableBicycle('Invalid Request Maker', {
      deliveryAvailable: false,
    })
    const hiddenBicycle = await createAvailableBicycle('Hidden Request Maker', {
      status: 'hidden',
    })

    const duplicateBicycles = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify(validOrderPayload([availableBicycle.id], {
        bicycleIds: [availableBicycle.id, availableBicycle.id],
      })),
    })
    expect(duplicateBicycles.status).toBe(400)

    const injectedMoney = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify({
        ...validOrderPayload([availableBicycle.id]),
        rentalAmountKopecks: 1,
      }),
    })
    expect(injectedMoney.status).toBe(400)

    const invalidDate = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify(validOrderPayload([availableBicycle.id], {
        startsOn: '2026-02-30',
      })),
    })
    expect(invalidDate.status).toBe(400)

    const tooLongPeriod = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify(validOrderPayload([availableBicycle.id], {
        endsOn: '2027-05-13',
      })),
    })
    expect(tooLongPeriod.status).toBe(400)

    const expensiveBicycle = await createAvailableBicycle('Expensive Request Maker', {
      pricePerDayKopecks: 100000000,
      depositKopecks: 100000000,
    })
    const excessiveTotal = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify(validOrderPayload([expensiveBicycle.id], {
        endsOn: '2026-05-21',
      })),
    })
    expect(excessiveTotal.status).toBe(400)

    const deliveryNotAvailable = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify(validOrderPayload([availableBicycle.id], {
        fulfillmentType: 'delivery',
        deliveryAddress: 'Circus arena, gate 4',
      })),
    })
    expect(deliveryNotAvailable.status).toBe(409)

    const hidden = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify(validOrderPayload([hiddenBicycle.id])),
    })
    expect(hidden.status).toBe(409)

    const orderCount = await prisma.order.count()
    expect(orderCount).toBe(0)
  })

  test('guards order creation and user-owned reads', async () => {
    const user = await registerUser('owner@example.com', 'Owner')
    const otherUser = await registerUser('other-owner@example.com', 'Other Owner')
    const manufacturer = await registerUser('order-maker@example.com', {
      displayName: 'Maker',
      role: 'manufacturer',
    })
    const bicycle = await createAvailableBicycle('Access Maker')

    const anonymous = await app.request('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validOrderPayload([bicycle.id])),
    })
    expect(anonymous.status).toBe(401)

    const manufacturerCreate = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify(validOrderPayload([bicycle.id])),
    })
    expect(manufacturerCreate.status).toBe(403)

    const create = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify(validOrderPayload([bicycle.id])),
    })
    const createBody = await create.json()
    expect(create.status).toBe(201)

    const otherDetail = await app.request(`/api/orders/${createBody.order.id}`, {
      headers: authHeaders(otherUser.accessToken),
    })
    expect(otherDetail.status).toBe(404)

    const otherList = await app.request('/api/orders?pageSize=10', {
      headers: authHeaders(otherUser.accessToken),
    })
    const otherListBody = await otherList.json()
    expect(otherList.status).toBe(200)
    expect(otherListBody.items).toHaveLength(0)
  })

  async function registerUser(
    email: string,
    options: string | { displayName?: string; role?: 'manufacturer' | 'user' } = {},
  ) {
    const displayName = typeof options === 'string' ? options : options.displayName
    const role = typeof options === 'string' ? undefined : options.role
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({
        email,
        password: 'password123',
        ...(displayName === undefined ? {} : { displayName }),
        ...(role === undefined ? {} : { role }),
      }),
    })

    expect(response.status).toBe(201)
    return response.json()
  }

  async function createAvailableBicycle(
    publicName: string,
    overrides: Partial<ReturnType<typeof bicyclePayload>> & { status?: 'available' | 'hidden' } = {},
  ) {
    const manufacturerUser = await prisma.user.create({
      data: {
        email: `${publicName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.com`,
        passwordHash: 'test-hash',
        displayName: publicName,
        role: 'manufacturer',
        status: 'active',
      },
    })
    const profile = await prisma.manufacturerProfile.create({
      data: {
        userId: manufacturerUser.id,
        legalName: `${publicName} LLC`,
        publicName,
        region: 'Moscow',
        city: 'Moscow',
        phone: '+7 999 000-00-00',
        email: `${publicName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.com`,
        description: 'Approved manufacturer profile.',
        status: 'approved',
        reviewedAt: new Date(),
      },
    })

    const { status, ...payloadOverrides } = overrides

    return prisma.bicycle.create({
      data: {
        ...bicyclePayload('Tiny Request Bike'),
        ...payloadOverrides,
        manufacturerProfileId: profile.id,
        status: status ?? 'available',
        reviewedAt: new Date(),
      },
    })
  }
})

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

function authJsonHeaders(accessToken: string) {
  return {
    ...authHeaders(accessToken),
    'Content-Type': 'application/json',
  }
}

function validOrderPayload(
  bicycleIds: string[],
  overrides: Record<string, unknown> = {},
) {
  return {
    bicycleIds,
    startsOn: '2026-05-12',
    endsOn: '2026-05-12',
    fulfillmentType: 'pickup',
    deliveryAddress: null,
    contactName: 'Trainer',
    contactPhone: '+7 999 111-22-33',
    userComment: 'Keep the bicycles indoors.',
    safetyAgreementAccepted: true,
    ...overrides,
  }
}

function bicyclePayload(title: string) {
  return {
    title,
    description: 'Compact bicycle for controlled circus rehearsals.',
    size: 'S' as 'S' | 'M' | 'L',
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
