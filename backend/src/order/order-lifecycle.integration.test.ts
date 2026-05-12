import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'
import { integrationDatabaseUrl } from '../test/integration-database'

const databaseUrl = integrationDatabaseUrl()

const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('order issue and return integration', () => {
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
    await prisma.order.deleteMany()
    await prisma.bicycle.deleteMany()
    await prisma.manufacturerProfile.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('issues a paid confirmed order with one issue checklist per bicycle', async () => {
    const admin = await createAdmin('issue-admin@example.com')
    const user = await registerUser('issue-owner@example.com', 'Owner')
    const firstBicycle = await createAvailableBicycle('Issue Maker One', {
      title: 'Issue Bike One',
    })
    const secondBicycle = await createAvailableBicycle('Issue Maker Two', {
      title: 'Issue Bike Two',
      depositKopecks: 0,
    })
    const order = await createConfirmedOrder(admin.accessToken, user.accessToken, [
      firstBicycle.id,
      secondBicycle.id,
    ])
    await payOrder(user.accessToken, order.order.id)

    const issue = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        comment: 'Issued after condition review.',
        checklists: checklistPayload([firstBicycle.id, secondBicycle.id], 'issue'),
      }),
    })
    const issueBody = await issue.json()

    expect(issue.status).toBe(200)
    expect(issueBody.order.status).toBe('issued')
    expect(issueBody.order.checklists.map((checklist: { type: string }) => checklist.type)).toEqual([
      'issue',
      'issue',
    ])
    expect(issueBody.order.checklists.every(
      (checklist: { checkedByUserId: string }) => checklist.checkedByUserId === admin.user.id,
    )).toBe(true)
    expect(issueBody.order.statusHistory.map((history: { toStatus: string }) => history.toStatus)).toEqual([
      'confirmed',
      'issued',
    ])
    expect(issueBody.order.paymentRequirementsMet).toBe(true)
    expect((await prisma.bicycle.findUniqueOrThrow({ where: { id: firstBicycle.id } })).status).toBe('rented')
    expect((await prisma.bicycle.findUniqueOrThrow({ where: { id: secondBicycle.id } })).status).toBe('rented')
    expect((await app.request(`/api/bicycles/${firstBicycle.id}`)).status).toBe(404)

    const repeatIssue = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload([firstBicycle.id, secondBicycle.id], 'issue'),
      }),
    })
    expect(repeatIssue.status).toBe(409)
    expect(await prisma.orderChecklist.count({ where: { orderId: order.order.id, type: 'issue' } })).toBe(2)
    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.order.id } })).toBe(2)
  })

  test('blocks issuing without successful payments and complete checklists', async () => {
    const admin = await createAdmin('issue-block-admin@example.com')
    const user = await registerUser('issue-block-owner@example.com', 'Owner')
    const bicycle = await createAvailableBicycle('Issue Block Maker')
    const order = await createConfirmedOrder(admin.accessToken, user.accessToken, [bicycle.id])

    const unpaidIssue = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload([bicycle.id], 'issue'),
      }),
    })
    const unpaidIssueBody = await unpaidIssue.json()
    expect(unpaidIssue.status).toBe(409)
    expect(unpaidIssueBody.error.code).toBe('PAYMENT_REQUIREMENTS_NOT_MET')

    const rent = await createPayment(user.accessToken, order.order.id, 'rent')
    expect((await completePayment(user.accessToken, rent.payment.id, 'stub-success')).status).toBe(200)
    const deposit = await createPayment(user.accessToken, order.order.id, 'deposit')
    expect(deposit.payment.status).toBe('pending')
    const pendingDepositIssue = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload([bicycle.id], 'issue'),
      }),
    })
    expect(pendingDepositIssue.status).toBe(409)

    expect((await completePayment(user.accessToken, deposit.payment.id, 'stub-success')).status).toBe(200)
    const issueSafetyAction = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload([bicycle.id], 'issue', () => ({
          safetyAction: 'maintenance',
        })),
      }),
    })
    const issueSafetyActionBody = await issueSafetyAction.json()
    expect(issueSafetyAction.status).toBe(400)
    expect(issueSafetyActionBody.error.code).toBe('VALIDATION_ERROR')

    await prisma.bicycle.update({
      where: { id: bicycle.id },
      data: { status: 'maintenance' },
    })
    const unavailableIssue = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload([bicycle.id], 'issue'),
      }),
    })
    const unavailableIssueBody = await unavailableIssue.json()
    expect(unavailableIssue.status).toBe(409)
    expect(unavailableIssueBody.error.code).toBe('BICYCLE_NOT_AVAILABLE')
    await prisma.bicycle.update({
      where: { id: bicycle.id },
      data: { status: 'available' },
    })

    await prisma.manufacturerProfile.update({
      where: { id: bicycle.manufacturerProfileId },
      data: { status: 'blocked' },
    })
    const blockedManufacturerIssue = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload([bicycle.id], 'issue'),
      }),
    })
    const blockedManufacturerIssueBody = await blockedManufacturerIssue.json()
    expect(blockedManufacturerIssue.status).toBe(409)
    expect(blockedManufacturerIssueBody.error.code).toBe('BICYCLE_NOT_AVAILABLE')
    expect(blockedManufacturerIssueBody.error.details.warnings[0]).toMatchObject({
      type: 'manufacturer_status',
      bicycleId: bicycle.id,
    })
    await prisma.manufacturerProfile.update({
      where: { id: bicycle.manufacturerProfileId },
      data: { status: 'approved' },
    })

    const missingChecklist = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: [],
      }),
    })
    expect(missingChecklist.status).toBe(400)

    const otherBicycle = await createAvailableBicycle('Issue Wrong Checklist Maker')
    const wrongChecklist = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload([otherBicycle.id], 'issue'),
      }),
    })
    const wrongChecklistBody = await wrongChecklist.json()
    expect(wrongChecklist.status).toBe(409)
    expect(wrongChecklistBody.error.code).toBe('CHECKLIST_BICYCLE_MISMATCH')
  })

  test('lets admins cancel confirmed orders with history but does not issue cancelled orders', async () => {
    const admin = await createAdmin('confirmed-cancel-admin@example.com')
    const user = await registerUser('confirmed-cancel-owner@example.com', 'Owner')
    const bicycle = await createAvailableBicycle('Confirmed Cancel Maker')
    const order = await createConfirmedOrder(admin.accessToken, user.accessToken, [bicycle.id])

    const cancel = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'cancelled',
        comment: 'Customer did not arrive.',
      }),
    })
    const cancelBody = await cancel.json()
    expect(cancel.status).toBe(200)
    expect(cancelBody.order.status).toBe('cancelled')
    expect(cancelBody.order.statusHistory[1]).toMatchObject({
      fromStatus: 'confirmed',
      toStatus: 'cancelled',
      comment: 'Customer did not arrive.',
    })

    const issueCancelled = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload([bicycle.id], 'issue'),
      }),
    })
    expect(issueCancelled.status).toBe(409)
  })

  test('returns issued orders without safety findings to the public catalog and blocks direct returns', async () => {
    const admin = await createAdmin('return-clean-admin@example.com')
    const user = await registerUser('return-clean-owner@example.com', 'Owner')
    const bicycle = await createAvailableBicycle('Return Clean Maker', {
      title: 'Return Clean Bike',
    })
    const confirmedOrder = await createConfirmedOrder(admin.accessToken, user.accessToken, [bicycle.id])

    const directReturn = await app.request(`/api/admin/orders/${confirmedOrder.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'returned',
        checklists: checklistPayload([bicycle.id], 'return'),
      }),
    })
    expect(directReturn.status).toBe(409)

    await payOrder(user.accessToken, confirmedOrder.order.id)
    const issue = await app.request(`/api/admin/orders/${confirmedOrder.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload([bicycle.id], 'issue'),
      }),
    })
    expect(issue.status).toBe(200)
    expect((await prisma.bicycle.findUniqueOrThrow({ where: { id: bicycle.id } })).status).toBe('rented')

    await prisma.bicycle.update({
      where: { id: bicycle.id },
      data: { status: 'hidden' },
    })
    const hiddenBeforeReturn = await app.request(`/api/admin/orders/${confirmedOrder.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'returned',
        checklists: checklistPayload([bicycle.id], 'return'),
      }),
    })
    const hiddenBeforeReturnBody = await hiddenBeforeReturn.json()
    expect(hiddenBeforeReturn.status).toBe(409)
    expect(hiddenBeforeReturnBody.error.code).toBe('BICYCLE_NOT_AVAILABLE')
    expect((await prisma.bicycle.findUniqueOrThrow({ where: { id: bicycle.id } })).status).toBe('hidden')
    await prisma.bicycle.update({
      where: { id: bicycle.id },
      data: { status: 'rented' },
    })

    const returnOrder = await app.request(`/api/admin/orders/${confirmedOrder.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'returned',
        checklists: checklistPayload([bicycle.id], 'return'),
      }),
    })
    const returnBody = await returnOrder.json()

    expect(returnOrder.status).toBe(200)
    expect(returnBody.order.status).toBe('returned')
    expect((await prisma.bicycle.findUniqueOrThrow({ where: { id: bicycle.id } })).status).toBe('available')
    expect((await app.request(`/api/bicycles/${bicycle.id}`)).status).toBe(200)
  })

  test('returns issued orders with return checklists and safety actions', async () => {
    const admin = await createAdmin('return-admin@example.com')
    const user = await registerUser('return-owner@example.com', 'Owner')
    const hiddenBicycle = await createAvailableBicycle('Return Hidden Maker', {
      title: 'Return Hidden Bike',
    })
    const maintenanceBicycle = await createAvailableBicycle('Return Maintenance Maker', {
      title: 'Return Maintenance Bike',
    })
    const order = await createIssuedOrder(admin.accessToken, user.accessToken, [
      hiddenBicycle.id,
      maintenanceBicycle.id,
    ])

    const returnOrder = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'returned',
        comment: 'Returned with safety findings.',
        checklists: checklistPayload([hiddenBicycle.id, maintenanceBicycle.id], 'return', (bicycleId) => ({
          exteriorCondition: bicycleId === hiddenBicycle.id ? 'unsafe' : 'damaged',
          safetyAction: bicycleId === hiddenBicycle.id ? 'hidden' : 'maintenance',
          comment: bicycleId === hiddenBicycle.id ? 'Hide until safety review.' : 'Send to workshop.',
        })),
      }),
    })
    const returnBody = await returnOrder.json()

    expect(returnOrder.status).toBe(200)
    expect(returnBody.order.status).toBe('returned')
    expect(returnBody.order.checklists.filter((checklist: { type: string }) => checklist.type === 'return')).toHaveLength(2)
    expect(returnBody.order.availabilityWarnings.some((warning: { severity: string }) => warning.severity === 'error')).toBe(false)
    expect(returnBody.order.statusHistory.map((history: { toStatus: string }) => history.toStatus)).toEqual([
      'confirmed',
      'issued',
      'returned',
    ])
    expect((await prisma.bicycle.findUniqueOrThrow({ where: { id: hiddenBicycle.id } })).status).toBe('hidden')
    expect((await prisma.bicycle.findUniqueOrThrow({ where: { id: maintenanceBicycle.id } })).status).toBe('maintenance')

    const publicHidden = await app.request(`/api/bicycles/${hiddenBicycle.id}`)
    const publicMaintenance = await app.request(`/api/bicycles/${maintenanceBicycle.id}`)
    expect(publicHidden.status).toBe(404)
    expect(publicMaintenance.status).toBe(404)

    const repeatReturn = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'returned',
        checklists: checklistPayload([hiddenBicycle.id, maintenanceBicycle.id], 'return'),
      }),
    })
    expect(repeatReturn.status).toBe(409)
    expect(await prisma.orderChecklist.count({ where: { orderId: order.order.id, type: 'return' } })).toBe(2)
  })

  test('serializes concurrent issue attempts', async () => {
    const admin = await createAdmin('issue-race-admin@example.com')
    const user = await registerUser('issue-race-owner@example.com', 'Owner')
    const bicycle = await createAvailableBicycle('Issue Race Maker')
    const order = await createConfirmedOrder(admin.accessToken, user.accessToken, [bicycle.id])
    await payOrder(user.accessToken, order.order.id)

    const responses = await Promise.all([
      app.request(`/api/admin/orders/${order.order.id}/status`, {
        method: 'PATCH',
        headers: authJsonHeaders(admin.accessToken),
        body: JSON.stringify({
          status: 'issued',
          checklists: checklistPayload([bicycle.id], 'issue'),
        }),
      }),
      app.request(`/api/admin/orders/${order.order.id}/status`, {
        method: 'PATCH',
        headers: authJsonHeaders(admin.accessToken),
        body: JSON.stringify({
          status: 'issued',
          checklists: checklistPayload([bicycle.id], 'issue'),
        }),
      }),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
    expect(await prisma.orderChecklist.count({ where: { orderId: order.order.id, type: 'issue' } })).toBe(1)
    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.order.id } })).toBe(2)
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

  async function createConfirmedOrder(
    adminAccessToken: string,
    userAccessToken: string,
    bicycleIds: string[],
  ) {
    const order = await createOrder(userAccessToken, bicycleIds)
    const confirm = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(adminAccessToken),
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(confirm.status).toBe(200)
    return order
  }

  async function createIssuedOrder(
    adminAccessToken: string,
    userAccessToken: string,
    bicycleIds: string[],
  ) {
    const order = await createConfirmedOrder(adminAccessToken, userAccessToken, bicycleIds)
    await payOrder(userAccessToken, order.order.id)
    const issue = await app.request(`/api/admin/orders/${order.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(adminAccessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: checklistPayload(bicycleIds, 'issue'),
      }),
    })
    expect(issue.status).toBe(200)
    return order
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

  async function payOrder(accessToken: string, orderId: string) {
    const rent = await createPayment(accessToken, orderId, 'rent')
    expect((await completePayment(accessToken, rent.payment.id, 'stub-success')).status).toBe(200)
    const deposit = await createPayment(accessToken, orderId, 'deposit')
    if (deposit.payment.status === 'pending') {
      expect((await completePayment(accessToken, deposit.payment.id, 'stub-success')).status).toBe(200)
    }
  }

  async function createPayment(accessToken: string, orderId: string, type: 'deposit' | 'rent') {
    const response = await app.request(`/api/orders/${orderId}/payments/${type}`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    })
    const body = await response.json()
    expect([200, 201]).toContain(response.status)
    return body
  }

  function completePayment(accessToken: string, paymentId: string, action: 'stub-success') {
    return app.request(`/api/payments/${paymentId}/${action}`, {
      method: 'POST',
      headers: authHeaders(accessToken),
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
        ...bicyclePayload('Tiny Lifecycle Bike'),
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

function checklistPayload(
  bicycleIds: string[],
  _type: 'issue' | 'return',
  overrides: (bicycleId: string) => Record<string, unknown> = () => ({}),
) {
  return bicycleIds.map((bicycleId) => ({
    bicycleId,
    frameCondition: 'ok',
    wheelsCondition: 'ok',
    handlebarCondition: 'ok',
    saddleCondition: 'ok',
    brakesCondition: 'not_applicable',
    exteriorCondition: 'ok',
    safetyAction: 'none',
    comment: 'Checklist completed.',
    ...overrides(bicycleId),
  }))
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
