import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'
import { integrationDatabaseUrl } from '../test/integration-database'

const databaseUrl = integrationDatabaseUrl()

const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('payment API integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:5173'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
    APP_ENV: 'test',
    PAYMENT_PROVIDER: 'stub',
    PAYMENT_STUB_DEV_ENDPOINTS_ENABLED: true,
    PAYMENT_CURRENCY: 'RUB',
  }
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.authSession.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.order.deleteMany()
    await prisma.bicycle.deleteMany()
    await prisma.manufacturerProfile.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('creates stub rent and deposit payments only for confirmed owner orders', async () => {
    const admin = await createAdmin('payment-admin@example.com')
    const user = await registerUser('payment-owner@example.com', 'Owner')
    const otherUser = await registerUser('payment-other@example.com', 'Other')
    const manufacturer = await registerUser('payment-role-maker@example.com', {
      displayName: 'Maker',
      role: 'manufacturer',
    })
    const bicycle = await createAvailableBicycle('Payment Maker')
    const request = await createOrder(user.accessToken, [bicycle.id], {
      startsOn: '2026-05-12',
      endsOn: '2026-05-13',
    })

    const unconfirmed = await app.request(`/api/orders/${request.order.id}/payments/rent`, {
      method: 'POST',
      headers: authHeaders(user.accessToken),
    })
    const unconfirmedBody = await unconfirmed.json()
    expect(unconfirmed.status).toBe(409)
    expect(unconfirmedBody.error.code).toBe('PAYMENT_NOT_ALLOWED')

    expect((await confirmOrder(admin.accessToken, request.order.id)).status).toBe(200)

    const rent = await app.request(`/api/orders/${request.order.id}/payments/rent`, {
      method: 'POST',
      headers: authHeaders(user.accessToken),
    })
    const rentBody = await rent.json()
    expect(rent.status).toBe(201)
    expect(rentBody.payment).toMatchObject({
      orderId: request.order.id,
      type: 'rent',
      provider: 'stub',
      status: 'pending',
      amountKopecks: 500000,
      currency: 'RUB',
    })

    const repeatedRent = await app.request(`/api/orders/${request.order.id}/payments/rent`, {
      method: 'POST',
      headers: authHeaders(user.accessToken),
    })
    const repeatedRentBody = await repeatedRent.json()
    expect(repeatedRent.status).toBe(200)
    expect(repeatedRentBody.payment.id).toBe(rentBody.payment.id)
    expect(await activePaymentCount(request.order.id, 'rent')).toBe(1)

    const deposit = await app.request(`/api/orders/${request.order.id}/payments/deposit`, {
      method: 'POST',
      headers: authHeaders(user.accessToken),
    })
    const depositBody = await deposit.json()
    expect(deposit.status).toBe(201)
    expect(depositBody.payment).toMatchObject({
      type: 'deposit',
      status: 'pending',
      amountKopecks: 500000,
    })

    const otherUserPayment = await app.request(`/api/orders/${request.order.id}/payments/rent`, {
      method: 'POST',
      headers: authHeaders(otherUser.accessToken),
    })
    expect(otherUserPayment.status).toBe(404)

    const manufacturerPayment = await app.request(`/api/orders/${request.order.id}/payments/rent`, {
      method: 'POST',
      headers: authHeaders(manufacturer.accessToken),
    })
    expect(manufacturerPayment.status).toBe(403)

    const adminPayments = await app.request('/api/admin/payments?pageSize=10', {
      headers: authHeaders(admin.accessToken),
    })
    const adminPaymentsBody = await adminPayments.json()
    expect(adminPayments.status).toBe(200)
    expect(adminPaymentsBody.items.map((payment: { id: string }) => payment.id)).toEqual([
      depositBody.payment.id,
      rentBody.payment.id,
    ])
    expect(adminPaymentsBody.items[0].order.user.email).toBe('payment-owner@example.com')

    const zeroDepositBicycle = await createAvailableBicycle('Zero Deposit Payment Maker', {
      depositKopecks: 0,
    })
    const zeroDepositOrder = await createOrder(user.accessToken, [zeroDepositBicycle.id], {
      startsOn: '2026-06-01',
      endsOn: '2026-06-01',
    })
    expect((await confirmOrder(admin.accessToken, zeroDepositOrder.order.id)).status).toBe(200)
    const zeroDeposit = await app.request(`/api/orders/${zeroDepositOrder.order.id}/payments/deposit`, {
      method: 'POST',
      headers: authHeaders(user.accessToken),
    })
    const zeroDepositBody = await zeroDeposit.json()
    expect(zeroDeposit.status).toBe(201)
    expect(zeroDepositBody.payment).toMatchObject({
      type: 'deposit',
      status: 'succeeded',
      amountKopecks: 0,
    })
  })

  test('completes stub payments idempotently and allows retry after failed or cancelled attempts', async () => {
    const admin = await createAdmin('payment-flow-admin@example.com')
    const user = await registerUser('payment-flow-owner@example.com', 'Owner')
    const bicycle = await createAvailableBicycle('Payment Flow Maker')
    const request = await createOrder(user.accessToken, [bicycle.id])
    expect((await confirmOrder(admin.accessToken, request.order.id)).status).toBe(200)

    const rentBody = await createPayment(user.accessToken, request.order.id, 'rent')
    const rentSuccess = await completePayment(user.accessToken, rentBody.payment.id, 'stub-success')
    const rentSuccessBody = await rentSuccess.json()
    expect(rentSuccess.status).toBe(200)
    expect(rentSuccessBody.payment.status).toBe('succeeded')

    const repeatedRentSuccess = await completePayment(user.accessToken, rentBody.payment.id, 'stub-success')
    const repeatedRentSuccessBody = await repeatedRentSuccess.json()
    expect(repeatedRentSuccess.status).toBe(200)
    expect(repeatedRentSuccessBody.payment.id).toBe(rentBody.payment.id)
    expect(repeatedRentSuccessBody.payment.status).toBe('succeeded')

    const failSucceededRent = await completePayment(user.accessToken, rentBody.payment.id, 'stub-fail')
    const failSucceededRentBody = await failSucceededRent.json()
    expect(failSucceededRent.status).toBe(409)
    expect(failSucceededRentBody.error.code).toBe('PAYMENT_NOT_COMPLETABLE')

    const firstDepositBody = await createPayment(user.accessToken, request.order.id, 'deposit')
    const failedDeposit = await completePayment(user.accessToken, firstDepositBody.payment.id, 'stub-fail')
    const failedDepositBody = await failedDeposit.json()
    expect(failedDeposit.status).toBe(200)
    expect(failedDepositBody.payment.status).toBe('failed')

    const secondDepositBody = await createPayment(user.accessToken, request.order.id, 'deposit')
    expect(secondDepositBody.payment.id).not.toBe(firstDepositBody.payment.id)
    expect(secondDepositBody.payment.status).toBe('pending')

    const cancelledDeposit = await completePayment(user.accessToken, secondDepositBody.payment.id, 'stub-cancel')
    const cancelledDepositBody = await cancelledDeposit.json()
    expect(cancelledDeposit.status).toBe(200)
    expect(cancelledDepositBody.payment.status).toBe('cancelled')

    const thirdDepositBody = await createPayment(user.accessToken, request.order.id, 'deposit')
    expect(thirdDepositBody.payment.id).not.toBe(secondDepositBody.payment.id)
    expect((await completePayment(user.accessToken, thirdDepositBody.payment.id, 'stub-success')).status).toBe(200)

    const detail = await app.request(`/api/orders/${request.order.id}`, {
      headers: authHeaders(user.accessToken),
    })
    const detailBody = await detail.json()
    expect(detail.status).toBe(200)
    expect(detailBody.order.paymentRequirementsMet).toBe(true)
    expect(detailBody.order.payments.map((payment: { status: string }) => payment.status)).toEqual([
      'succeeded',
      'failed',
      'cancelled',
      'succeeded',
    ])
  })

  test('serializes concurrent active payment creation per order and type', async () => {
    const admin = await createAdmin('payment-concurrent-admin@example.com')
    const user = await registerUser('payment-concurrent-owner@example.com', 'Owner')
    const bicycle = await createAvailableBicycle('Concurrent Payment Maker')
    const request = await createOrder(user.accessToken, [bicycle.id])
    expect((await confirmOrder(admin.accessToken, request.order.id)).status).toBe(200)

    const responses = await Promise.all([
      app.request(`/api/orders/${request.order.id}/payments/rent`, {
        method: 'POST',
        headers: authHeaders(user.accessToken),
      }),
      app.request(`/api/orders/${request.order.id}/payments/rent`, {
        method: 'POST',
        headers: authHeaders(user.accessToken),
      }),
    ])
    const bodies = await Promise.all(responses.map((response) => response.json()))

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201])
    expect(new Set(bodies.map((body) => body.payment.id)).size).toBe(1)
    expect(await activePaymentCount(request.order.id, 'rent')).toBe(1)
  })

  test('honors provider and dev endpoint configuration', async () => {
    const admin = await createAdmin('payment-config-admin@example.com')
    const user = await registerUser('payment-config-owner@example.com', 'Owner')
    const bicycle = await createAvailableBicycle('Config Payment Maker')
    const request = await createOrder(user.accessToken, [bicycle.id])
    expect((await confirmOrder(admin.accessToken, request.order.id)).status).toBe(200)

    const providerDisabledApp = createApp({
      env: {
        ...env,
        PAYMENT_PROVIDER: 'disabled',
      },
      prisma,
    })
    const disabledProvider = await providerDisabledApp.request(
      `/api/orders/${request.order.id}/payments/rent`,
      {
        method: 'POST',
        headers: authHeaders(user.accessToken),
      },
    )
    const disabledProviderBody = await disabledProvider.json()
    expect(disabledProvider.status).toBe(503)
    expect(disabledProviderBody.error.code).toBe('PAYMENT_PROVIDER_DISABLED')

    const rentBody = await createPayment(user.accessToken, request.order.id, 'rent')
    const devDisabledApp = createApp({
      env: {
        ...env,
        PAYMENT_STUB_DEV_ENDPOINTS_ENABLED: false,
      },
      prisma,
    })
    const disabledDevEndpoint = await devDisabledApp.request(
      `/api/payments/${rentBody.payment.id}/stub-success`,
      {
        method: 'POST',
        headers: authHeaders(user.accessToken),
      },
    )
    const disabledDevEndpointBody = await disabledDevEndpoint.json()
    expect(disabledDevEndpoint.status).toBe(403)
    expect(disabledDevEndpointBody.error.code).toBe('PAYMENT_DEV_ENDPOINTS_DISABLED')
  })

  test('does not expose order issuance before the issuance flow owns payment gating', async () => {
    const admin = await createAdmin('payment-issue-admin@example.com')
    const user = await registerUser('payment-issue-owner@example.com', 'Owner')
    const bicycle = await createAvailableBicycle('Issue Guard Payment Maker')
    const request = await createOrder(user.accessToken, [bicycle.id])
    expect((await confirmOrder(admin.accessToken, request.order.id)).status).toBe(200)

    const issue = await app.request(`/api/admin/orders/${request.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'issued' }),
    })
    expect(issue.status).toBe(400)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: request.order.id } })).status).toBe('confirmed')
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

  async function createAdmin(email: string) {
    const body = await registerUser(email, 'Admin')
    await prisma.user.update({
      where: { email },
      data: {
        role: 'admin',
        status: 'active',
      },
    })
    return body
  }

  async function createOrder(
    accessToken: string,
    bicycleIds: string[],
    overrides: Record<string, unknown> = {},
  ) {
    const response = await app.request('/api/orders', {
      method: 'POST',
      headers: authJsonHeaders(accessToken),
      body: JSON.stringify(validOrderPayload(bicycleIds, overrides)),
    })
    const body = await response.json()
    expect(response.status).toBe(201)
    return body
  }

  function confirmOrder(accessToken: string, orderId: string) {
    return app.request(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(accessToken),
      body: JSON.stringify({ status: 'confirmed' }),
    })
  }

  async function createPayment(accessToken: string, orderId: string, type: 'deposit' | 'rent') {
    const response = await app.request(`/api/orders/${orderId}/payments/${type}`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    })
    const body = await response.json()
    expect(response.status).toBe(201)
    return body
  }

  function completePayment(accessToken: string, paymentId: string, action: 'stub-cancel' | 'stub-fail' | 'stub-success') {
    return app.request(`/api/payments/${paymentId}/${action}`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    })
  }

  async function activePaymentCount(orderId: string, type: 'deposit' | 'rent') {
    return prisma.payment.count({
      where: {
        orderId,
        type,
        status: { in: ['pending', 'succeeded'] },
      },
    })
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
