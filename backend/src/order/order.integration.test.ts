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

  test('lets admins confirm or cancel requests and writes status history', async () => {
    const admin = await createAdmin('orders-admin@example.com')
    const user = await registerUser('admin-flow-renter@example.com', 'Renter')
    const bicycle = await createAvailableBicycle('Admin Flow Maker')
    const createBody = await createOrder(user.accessToken, [bicycle.id], {
      startsOn: '2026-05-12',
      endsOn: '2026-05-13',
    })

    const list = await app.request('/api/admin/orders?status=request&pageSize=10', {
      headers: authHeaders(admin.accessToken),
    })
    const listBody = await list.json()
    expect(list.status).toBe(200)
    expect(listBody.items.map((order: { id: string }) => order.id)).toContain(createBody.order.id)
    expect(listBody.items[0].availabilityWarnings.some(
      (warning: { type: string }) => warning.type === 'technical_limits',
    )).toBe(true)

    const listWithScope = await app.request('/api/admin/orders?scope=current', {
      headers: authHeaders(admin.accessToken),
    })
    const listWithScopeBody = await listWithScope.json()
    expect(listWithScope.status).toBe(400)
    expect(listWithScopeBody.error.code).toBe('VALIDATION_ERROR')

    const confirm = await app.request(`/api/admin/orders/${createBody.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'confirmed',
        comment: 'Approved after availability review.',
      }),
    })
    const confirmBody = await confirm.json()
    expect(confirm.status).toBe(200)
    expect(confirmBody.order.status).toBe('confirmed')
    expect(confirmBody.order.adminComment).toBe('Approved after availability review.')
    expect(confirmBody.order.statusHistory).toHaveLength(1)
    expect(confirmBody.order.statusHistory[0]).toMatchObject({
      fromStatus: 'request',
      toStatus: 'confirmed',
      changedByUserId: admin.user.id,
      comment: 'Approved after availability review.',
    })

    const repeatConfirm = await app.request(`/api/admin/orders/${createBody.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(repeatConfirm.status).toBe(409)
    expect(await prisma.orderStatusHistory.count({ where: { orderId: createBody.order.id } })).toBe(1)

    const cancellableBody = await createOrder(user.accessToken, [bicycle.id], {
      startsOn: '2026-06-01',
      endsOn: '2026-06-01',
    })
    const cancelWithoutComment = await app.request(`/api/admin/orders/${cancellableBody.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'cancelled' }),
    })
    expect(cancelWithoutComment.status).toBe(400)

    const cancel = await app.request(`/api/admin/orders/${cancellableBody.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'cancelled',
        comment: 'Dates no longer work.',
      }),
    })
    const cancelBody = await cancel.json()
    expect(cancel.status).toBe(200)
    expect(cancelBody.order.status).toBe('cancelled')
    expect(cancelBody.order.statusHistory[0]).toMatchObject({
      fromStatus: 'request',
      toStatus: 'cancelled',
      changedByUserId: admin.user.id,
      comment: 'Dates no longer work.',
    })
  })

  test('blocks conflicting confirmations with inclusive date rules', async () => {
    const admin = await createAdmin('conflict-admin@example.com')
    const user = await registerUser('conflict-renter@example.com', 'Renter')
    const bicycle = await createAvailableBicycle('Conflict Maker')
    const first = await createOrder(user.accessToken, [bicycle.id], {
      startsOn: '2026-05-12',
      endsOn: '2026-05-13',
    })
    const touching = await createOrder(user.accessToken, [bicycle.id], {
      startsOn: '2026-05-13',
      endsOn: '2026-05-14',
    })
    const adjacent = await createOrder(user.accessToken, [bicycle.id], {
      startsOn: '2026-05-14',
      endsOn: '2026-05-15',
    })

    const confirmFirst = await confirmOrder(admin.accessToken, first.order.id)
    expect(confirmFirst.status).toBe(200)

    const confirmTouching = await confirmOrder(admin.accessToken, touching.order.id)
    const confirmTouchingBody = await confirmTouching.json()
    expect(confirmTouching.status).toBe(409)
    expect(confirmTouchingBody.error.code).toBe('ORDER_AVAILABILITY_CONFLICT')
    expect(confirmTouchingBody.error.details.conflicts[0]).toMatchObject({
      bicycleId: bicycle.id,
      conflictingOrderId: first.order.id,
      startsOn: '2026-05-12',
      endsOn: '2026-05-13',
      status: 'confirmed',
    })

    const confirmAdjacent = await confirmOrder(admin.accessToken, adjacent.order.id)
    expect(confirmAdjacent.status).toBe(200)
  })

  test('serializes concurrent confirmations for the same bicycle', async () => {
    const admin = await createAdmin('concurrent-order-admin@example.com')
    const user = await registerUser('concurrent-renter@example.com', 'Renter')
    const bicycle = await createAvailableBicycle('Concurrent Maker')
    const first = await createOrder(user.accessToken, [bicycle.id], {
      startsOn: '2026-07-01',
      endsOn: '2026-07-03',
    })
    const second = await createOrder(user.accessToken, [bicycle.id], {
      startsOn: '2026-07-02',
      endsOn: '2026-07-04',
    })

    const responses = await Promise.all([
      confirmOrder(admin.accessToken, first.order.id),
      confirmOrder(admin.accessToken, second.order.id),
    ])
    const statuses = responses.map((response) => response.status).sort()

    expect(statuses).toEqual([200, 409])
    expect(await prisma.order.count({ where: { status: 'confirmed' } })).toBe(1)
    expect(await prisma.orderStatusHistory.count()).toBe(1)
  })

  test('lets users cancel only their own pending requests', async () => {
    const admin = await createAdmin('cancel-admin@example.com')
    const user = await registerUser('cancel-owner@example.com', 'Owner')
    const otherUser = await registerUser('cancel-other@example.com', 'Other Owner')
    const bicycle = await createAvailableBicycle('Cancel Maker')
    const request = await createOrder(user.accessToken, [bicycle.id])

    const otherCancel = await app.request(`/api/orders/${request.order.id}/cancel`, {
      method: 'POST',
      headers: authJsonHeaders(otherUser.accessToken),
      body: JSON.stringify({}),
    })
    expect(otherCancel.status).toBe(404)

    const cancel = await app.request(`/api/orders/${request.order.id}/cancel`, {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify({ comment: 'No longer needed.' }),
    })
    const cancelBody = await cancel.json()
    expect(cancel.status).toBe(200)
    expect(cancelBody.order.status).toBe('cancelled')
    expect(await prisma.orderStatusHistory.count({ where: { orderId: request.order.id } })).toBe(1)

    const confirmed = await createOrder(user.accessToken, [bicycle.id], {
      startsOn: '2026-08-01',
      endsOn: '2026-08-01',
    })
    const confirm = await app.request(`/api/admin/orders/${confirmed.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'confirmed',
        comment: 'Internal availability note.',
      }),
    })
    expect(confirm.status).toBe(200)
    const confirmedDetail = await app.request(`/api/orders/${confirmed.order.id}`, {
      headers: authHeaders(user.accessToken),
    })
    const confirmedDetailBody = await confirmedDetail.json()
    expect(confirmedDetail.status).toBe(200)
    expect('adminComment' in confirmedDetailBody.order).toBe(false)
    const cancelConfirmed = await app.request(`/api/orders/${confirmed.order.id}/cancel`, {
      method: 'POST',
      headers: authJsonHeaders(user.accessToken),
      body: JSON.stringify({}),
    })
    expect(cancelConfirmed.status).toBe(409)

    const currentList = await app.request('/api/orders?scope=current&pageSize=10', {
      headers: authHeaders(user.accessToken),
    })
    const currentListBody = await currentList.json()
    expect(currentList.status).toBe(200)
    expect(currentListBody.items.map((order: { status: string }) => order.status)).toEqual(['confirmed'])
    expect(currentListBody.items.every((order: Record<string, unknown>) => !('adminComment' in order))).toBe(true)

    const historyList = await app.request('/api/orders?scope=history&pageSize=10', {
      headers: authHeaders(user.accessToken),
    })
    const historyListBody = await historyList.json()
    expect(historyList.status).toBe(200)
    expect(historyListBody.items.map((order: { status: string }) => order.status)).toEqual(['cancelled'])

    const invalidScopedStatus = await app.request('/api/orders?scope=current&status=returned', {
      headers: authHeaders(user.accessToken),
    })
    const invalidScopedStatusBody = await invalidScopedStatus.json()
    expect(invalidScopedStatus.status).toBe(400)
    expect(invalidScopedStatusBody.error.code).toBe('VALIDATION_ERROR')

    const invalidScope = await app.request('/api/orders?scope=stale', {
      headers: authHeaders(user.accessToken),
    })
    const invalidScopeBody = await invalidScope.json()
    expect(invalidScope.status).toBe(400)
    expect(invalidScopeBody.error.code).toBe('VALIDATION_ERROR')

    const invalidStatus = await app.request('/api/orders?status=lost', {
      headers: authHeaders(user.accessToken),
    })
    const invalidStatusBody = await invalidStatus.json()
    expect(invalidStatus.status).toBe(400)
    expect(invalidStatusBody.error.code).toBe('VALIDATION_ERROR')

    const invalidAdminStatus = await app.request('/api/admin/orders?status=lost', {
      headers: authHeaders(admin.accessToken),
    })
    const invalidAdminStatusBody = await invalidAdminStatus.json()
    expect(invalidAdminStatus.status).toBe(400)
    expect(invalidAdminStatusBody.error.code).toBe('VALIDATION_ERROR')
  })

  test('lets manufacturers view only their related order slice', async () => {
    const admin = await createAdmin('producer-order-admin@example.com')
    const user = await registerUser('producer-order-renter@example.com', 'Renter')
    const firstManufacturer = await createApprovedManufacturerBicycle(
      'producer-order-first@example.com',
      'Producer Orders First',
      'First Producer Bike',
    )
    const secondManufacturer = await createApprovedManufacturerBicycle(
      'producer-order-second@example.com',
      'Producer Orders Second',
      'Second Producer Bike',
    )
    const unrelatedManufacturer = await createApprovedManufacturerBicycle(
      'producer-order-unrelated@example.com',
      'Producer Orders Unrelated',
      'Unrelated Producer Bike',
    )
    const request = await createOrder(user.accessToken, [
      firstManufacturer.bicycle.id,
      secondManufacturer.bicycle.id,
    ], {
      startsOn: '2026-09-01',
      endsOn: '2026-09-02',
      fulfillmentType: 'delivery',
      deliveryAddress: 'Circus arena, gate 4',
    })

    const firstRequestDetail = await app.request(`/api/manufacturer/orders/${request.order.id}`, {
      headers: authHeaders(firstManufacturer.accessToken),
    })
    const firstRequestDetailBody = await firstRequestDetail.json()
    expect(firstRequestDetail.status).toBe(200)
    expect(firstRequestDetailBody.order.status).toBe('request')
    expect(firstRequestDetailBody.order.fulfillmentContact).toBeNull()

    const confirm = await app.request(`/api/admin/orders/${request.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'confirmed',
        comment: 'Internal producer order note.',
      }),
    })
    expect(confirm.status).toBe(200)

    const firstList = await app.request('/api/manufacturer/orders?scope=current&pageSize=10', {
      headers: authHeaders(firstManufacturer.accessToken),
    })
    const firstListBody = await firstList.json()
    expect(firstList.status).toBe(200)
    expect(firstListBody.total).toBe(1)
    expect(firstListBody.items[0]).toMatchObject({
      id: request.order.id,
      status: 'confirmed',
      manufacturerRentalAmountKopecks: 500000,
      manufacturerDepositAmountKopecks: 500000,
      manufacturerTotalAmountKopecks: 1000000,
      fulfillmentContact: {
        contactName: 'Trainer',
        contactPhone: '+7 999 111-22-33',
        deliveryAddress: 'Circus arena, gate 4',
        userComment: 'Keep the bicycles indoors.',
      },
    })
    expect(firstListBody.items[0].items.map((item: { bicycleId: string }) => item.bicycleId)).toEqual([
      firstManufacturer.bicycle.id,
    ])

    const firstConfirmedDetail = await app.request(`/api/manufacturer/orders/${request.order.id}`, {
      headers: authHeaders(firstManufacturer.accessToken),
    })
    const firstConfirmedDetailBody = await firstConfirmedDetail.json()
    expect(firstConfirmedDetail.status).toBe(200)
    expect(firstConfirmedDetailBody.order.fulfillmentContact).toMatchObject({
      contactName: 'Trainer',
      contactPhone: '+7 999 111-22-33',
      deliveryAddress: 'Circus arena, gate 4',
    })

    const secondList = await app.request('/api/manufacturer/orders?pageSize=10', {
      headers: authHeaders(secondManufacturer.accessToken),
    })
    const secondListBody = await secondList.json()
    expect(secondList.status).toBe(200)
    expect(secondListBody.items[0].items.map((item: { bicycleId: string }) => item.bicycleId)).toEqual([
      secondManufacturer.bicycle.id,
    ])

    const unrelatedList = await app.request('/api/manufacturer/orders?pageSize=10', {
      headers: authHeaders(unrelatedManufacturer.accessToken),
    })
    const unrelatedListBody = await unrelatedList.json()
    expect(unrelatedList.status).toBe(200)
    expect(unrelatedListBody.total).toBe(0)

    const unrelatedDetail = await app.request(`/api/manufacturer/orders/${request.order.id}`, {
      headers: authHeaders(unrelatedManufacturer.accessToken),
    })
    expect(unrelatedDetail.status).toBe(404)

    const invalidScopedStatus = await app.request('/api/manufacturer/orders?scope=current&status=returned', {
      headers: authHeaders(firstManufacturer.accessToken),
    })
    const invalidScopedStatusBody = await invalidScopedStatus.json()
    expect(invalidScopedStatus.status).toBe(400)
    expect(invalidScopedStatusBody.error.code).toBe('VALIDATION_ERROR')

    const invalidStatus = await app.request('/api/manufacturer/orders?status=lost', {
      headers: authHeaders(firstManufacturer.accessToken),
    })
    const invalidStatusBody = await invalidStatus.json()
    expect(invalidStatus.status).toBe(400)
    expect(invalidStatusBody.error.code).toBe('VALIDATION_ERROR')

    const rawFirstList = JSON.stringify(firstListBody)
    expect(rawFirstList).not.toContain('producer-order-renter@example.com')
    expect(rawFirstList).not.toContain('adminComment')
    expect(rawFirstList).not.toContain('Internal producer order note.')
    expect(rawFirstList).not.toContain('payments')
    expect(rawFirstList).not.toContain(secondManufacturer.bicycle.id)
    expect(rawFirstList).not.toContain('Second Producer Bike')

    await completeOrderPayments(user.accessToken, request.order.id)

    const issue = await app.request(`/api/admin/orders/${request.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: [
          orderChecklist(firstManufacturer.bicycle.id),
          orderChecklist(secondManufacturer.bicycle.id),
        ],
      }),
    })
    expect(issue.status).toBe(200)

    const returnOrder = await app.request(`/api/admin/orders/${request.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'returned',
        checklists: [
          orderChecklist(firstManufacturer.bicycle.id),
          orderChecklist(secondManufacturer.bicycle.id, 'maintenance'),
        ],
      }),
    })
    expect(returnOrder.status).toBe(200)

    const firstDetail = await app.request(`/api/manufacturer/orders/${request.order.id}`, {
      headers: authHeaders(firstManufacturer.accessToken),
    })
    const firstDetailBody = await firstDetail.json()
    expect(firstDetail.status).toBe(200)
    expect(firstDetailBody.order.status).toBe('returned')
    expect(firstDetailBody.order.fulfillmentContact).toBeNull()
    expect(firstDetailBody.order.items.map((item: { bicycleId: string }) => item.bicycleId)).toEqual([
      firstManufacturer.bicycle.id,
    ])
    expect(firstDetailBody.order.checklists.map((checklist: { bicycleId: string; type: string }) => ({
      bicycleId: checklist.bicycleId,
      type: checklist.type,
    }))).toEqual([
      { bicycleId: firstManufacturer.bicycle.id, type: 'issue' },
      { bicycleId: firstManufacturer.bicycle.id, type: 'return' },
    ])

    const rawFirstDetail = JSON.stringify(firstDetailBody)
    expect(rawFirstDetail).not.toContain('producer-order-renter@example.com')
    expect(rawFirstDetail).not.toContain('adminComment')
    expect(rawFirstDetail).not.toContain('payments')
    expect(rawFirstDetail).not.toContain('checkedBy')
    expect(rawFirstDetail).not.toContain('changedBy')
    expect(rawFirstDetail).not.toContain(secondManufacturer.bicycle.id)
    expect(rawFirstDetail).not.toContain('Second Producer Bike')
  })

  test('lists admin quick filters and checklists without client-side fetch-all', async () => {
    const admin = await createAdmin('quick-admin@example.com')
    const user = await registerUser('quick-renter@example.com', 'Renter')
    const requestBicycle = await createAvailableBicycle('Quick Request Maker', {
      title: 'Quick Request Bike',
    })
    const unpaidBicycle = await createAvailableBicycle('Quick Unpaid Maker', {
      title: 'Quick Unpaid Bike',
    })
    const cancelledBicycle = await createAvailableBicycle('Quick Cancelled Maker', {
      title: 'Quick Cancelled Bike',
    })
    const checklistBicycle = await createAvailableBicycle('Quick Checklist Maker', {
      title: 'Quick Checklist Bike',
    })

    const requestOrder = await createOrder(user.accessToken, [requestBicycle.id], {
      startsOn: '2026-05-13',
      endsOn: '2026-05-14',
    })
    const unpaidOrder = await createOrder(user.accessToken, [unpaidBicycle.id], {
      startsOn: '2026-05-13',
      endsOn: '2026-05-13',
    })
    const confirmUnpaid = await confirmOrder(admin.accessToken, unpaidOrder.order.id)
    expect(confirmUnpaid.status).toBe(200)

    const cancelledOrder = await createOrder(user.accessToken, [cancelledBicycle.id], {
      startsOn: '2026-05-10',
      endsOn: '2026-05-10',
    })
    const cancel = await app.request(`/api/admin/orders/${cancelledOrder.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'cancelled',
        comment: 'Customer changed schedule.',
      }),
    })
    expect(cancel.status).toBe(200)

    const checklistOrder = await createOrder(user.accessToken, [checklistBicycle.id], {
      startsOn: '2026-05-11',
      endsOn: '2026-05-11',
    })
    const confirmChecklist = await confirmOrder(admin.accessToken, checklistOrder.order.id)
    expect(confirmChecklist.status).toBe(200)
    await completeOrderPayments(user.accessToken, checklistOrder.order.id)

    const issue = await app.request(`/api/admin/orders/${checklistOrder.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'issued',
        checklists: [orderChecklist(checklistBicycle.id)],
      }),
    })
    expect(issue.status).toBe(200)

    const returned = await app.request(`/api/admin/orders/${checklistOrder.order.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        status: 'returned',
        checklists: [orderChecklist(checklistBicycle.id, 'maintenance')],
      }),
    })
    expect(returned.status).toBe(200)

    const unconfirmed = await app.request('/api/admin/orders?quickFilter=unconfirmed_requests&pageSize=10', {
      headers: authHeaders(admin.accessToken),
    })
    const unconfirmedBody = await unconfirmed.json()
    expect(unconfirmed.status).toBe(200)
    expect(unconfirmedBody.items.map((order: { id: string }) => order.id)).toEqual([
      requestOrder.order.id,
    ])

    const today = await app.request('/api/admin/orders?quickFilter=orders_today&date=2026-05-13&pageSize=10', {
      headers: authHeaders(admin.accessToken),
    })
    const todayBody = await today.json()
    const todayIds = todayBody.items.map((order: { id: string }) => order.id)
    expect(today.status).toBe(200)
    expect(todayIds).toContain(requestOrder.order.id)
    expect(todayIds).toContain(unpaidOrder.order.id)
    expect(todayIds).not.toContain(cancelledOrder.order.id)
    expect(todayIds).not.toContain(checklistOrder.order.id)

    const unpaidDeposit = await app.request('/api/admin/orders?quickFilter=unpaid_deposit&pageSize=10', {
      headers: authHeaders(admin.accessToken),
    })
    const unpaidDepositBody = await unpaidDeposit.json()
    expect(unpaidDeposit.status).toBe(200)
    expect(unpaidDepositBody.items.map((order: { id: string }) => order.id)).toEqual([
      unpaidOrder.order.id,
    ])

    const cancelled = await app.request('/api/admin/orders?quickFilter=cancelled_orders&pageSize=10', {
      headers: authHeaders(admin.accessToken),
    })
    const cancelledBody = await cancelled.json()
    expect(cancelled.status).toBe(200)
    expect(cancelledBody.items.map((order: { id: string }) => order.id)).toEqual([
      cancelledOrder.order.id,
    ])

    const invalidQuickFilter = await app.request('/api/admin/orders?quickFilter=orders_today&status=request', {
      headers: authHeaders(admin.accessToken),
    })
    expect(invalidQuickFilter.status).toBe(400)

    const invalidDate = await app.request('/api/admin/orders?date=2026-05-13', {
      headers: authHeaders(admin.accessToken),
    })
    expect(invalidDate.status).toBe(400)

    const returnChecklists = await app.request('/api/admin/checklists?type=return&pageSize=10', {
      headers: authHeaders(admin.accessToken),
    })
    const returnChecklistsBody = await returnChecklists.json()
    expect(returnChecklists.status).toBe(200)
    expect(returnChecklistsBody.items).toHaveLength(1)
    expect(returnChecklistsBody.items[0]).toMatchObject({
      orderId: checklistOrder.order.id,
      bicycleId: checklistBicycle.id,
      type: 'return',
      safetyAction: 'maintenance',
      order: {
        id: checklistOrder.order.id,
        user: {
          email: 'quick-renter@example.com',
        },
      },
      bicycle: {
        id: checklistBicycle.id,
        title: 'Quick Checklist Bike',
        status: 'maintenance',
      },
    })
    expect(returnChecklistsBody.items[0].checkedByUser.email).toBe('quick-admin@example.com')

    const pagedChecklists = await app.request('/api/admin/checklists?pageSize=1', {
      headers: authHeaders(admin.accessToken),
    })
    const pagedChecklistsBody = await pagedChecklists.json()
    expect(pagedChecklists.status).toBe(200)
    expect(pagedChecklistsBody.items).toHaveLength(1)
    expect(pagedChecklistsBody.total).toBe(2)

    const nonAdminChecklists = await app.request('/api/admin/checklists?pageSize=10', {
      headers: authHeaders(user.accessToken),
    })
    expect(nonAdminChecklists.status).toBe(403)
  })

  test('blocks confirmation when live bicycle state changes after request creation', async () => {
    const admin = await createAdmin('live-state-admin@example.com')
    const user = await registerUser('live-state-renter@example.com', 'Renter')
    const bicycle = await createAvailableBicycle('Live State Maker')
    const request = await createOrder(user.accessToken, [bicycle.id])

    await prisma.bicycle.update({
      where: { id: bicycle.id },
      data: { status: 'maintenance' },
    })

    const confirm = await confirmOrder(admin.accessToken, request.order.id)
    const confirmBody = await confirm.json()
    expect(confirm.status).toBe(409)
    expect(confirmBody.error.code).toBe('BICYCLE_NOT_AVAILABLE')
    expect(confirmBody.error.details.warnings[0]).toMatchObject({
      type: 'bicycle_status',
      bicycleId: bicycle.id,
      severity: 'error',
    })
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

  async function createApprovedManufacturerBicycle(
    email: string,
    publicName: string,
    bicycleTitle: string,
  ) {
    const manufacturer = await registerUser(email, {
      displayName: publicName,
      role: 'manufacturer',
    })
    const profile = await prisma.manufacturerProfile.create({
      data: {
        userId: manufacturer.user.id,
        legalName: `${publicName} LLC`,
        publicName,
        region: 'Moscow',
        city: 'Moscow',
        phone: '+7 999 000-00-00',
        email,
        description: 'Approved manufacturer profile.',
        status: 'approved',
        reviewedAt: new Date(),
      },
    })
    const bicycle = await prisma.bicycle.create({
      data: {
        ...bicyclePayload(bicycleTitle),
        manufacturerProfileId: profile.id,
        status: 'available',
        reviewedAt: new Date(),
      },
    })

    return {
      ...manufacturer,
      profile,
      bicycle,
    }
  }

  async function completeOrderPayments(accessToken: string, orderId: string) {
    for (const type of ['rent', 'deposit'] as const) {
      const create = await app.request(`/api/orders/${orderId}/payments/${type}`, {
        method: 'POST',
        headers: authHeaders(accessToken),
      })
      const createBody = await create.json()
      expect(create.status).toBe(201)

      const complete = await app.request(`/api/payments/${createBody.payment.id}/stub-success`, {
        method: 'POST',
        headers: authHeaders(accessToken),
      })
      expect(complete.status).toBe(200)
    }
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

function orderChecklist(
  bicycleId: string,
  safetyAction: 'hidden' | 'maintenance' | 'none' = 'none',
) {
  return {
    bicycleId,
    frameCondition: 'ok',
    wheelsCondition: 'ok',
    handlebarCondition: 'ok',
    saddleCondition: 'ok',
    brakesCondition: 'ok',
    exteriorCondition: safetyAction === 'none' ? 'worn' : 'unsafe',
    safetyAction,
    comment: safetyAction === 'none' ? 'Ready for normal operation.' : 'Needs follow-up service.',
  }
}
