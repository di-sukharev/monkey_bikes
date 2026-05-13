import { describe, expect, test } from 'bun:test'
import {
  adminBicycleModerationRequestSchema,
  adminBicycleSchema,
  adminOrderChecklistInputSchema,
  adminManufacturerStatusUpdateRequestSchema,
  adminOrdersQuerySchema,
  adminOrderSchema,
  adminOrderStatusUpdateRequestSchema,
  adminUpdateUserRequestSchema,
  adminUsersQuerySchema,
  apiErrorCodeSchema,
  bicycleSchema,
  bicycleUpsertRequestSchema,
  manufacturerProfileSchema,
  manufacturerProfileSubmitResponseSchema,
  manufacturerProfileUpsertRequestSchema,
  manufacturerOrderSchema,
  manufacturerOrdersQuerySchema,
  orderCancelRequestSchema,
  orderCreateRequestSchema,
  ordersQuerySchema,
  orderSchema,
  paymentResponseSchema,
  paymentSchema,
  publicBicyclesQuerySchema,
  registerRequestSchema,
  userSchema,
} from '@web-app-demo/contracts'

describe('contracts', () => {
  test('normalizes auth registration payloads', () => {
    const result = registerRequestSchema.parse({
      email: ' USER@Example.COM ',
      password: 'password123',
      displayName: '',
    })

    expect(result).toEqual({
      email: 'user@example.com',
      password: 'password123',
      displayName: undefined,
      role: 'user',
    })
  })

  test('allows manufacturer self-registration without admin role escalation', () => {
    const result = registerRequestSchema.parse({
      email: ' maker@example.com ',
      password: 'password123',
      role: 'manufacturer',
    })

    expect(result.role).toBe('manufacturer')
    expect(() =>
      registerRequestSchema.parse({
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      }),
    ).toThrow()
  })

  test('parses user role and status DTO fields', () => {
    const result = userSchema.parse({
      id: 'user_1',
      email: 'user@example.com',
      displayName: null,
      role: 'manufacturer',
      status: 'active',
      createdAt: '2026-05-12T10:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
    })

    expect(result.role).toBe('manufacturer')
    expect(result.status).toBe('active')
  })

  test('normalizes admin users query defaults', () => {
    const result = adminUsersQuerySchema.parse({})

    expect(result).toEqual({
      page: 1,
      pageSize: 20,
    })
  })

  test('requires at least one admin user patch field', () => {
    expect(() => adminUpdateUserRequestSchema.parse({})).toThrow()
    expect(adminUpdateUserRequestSchema.parse({ status: 'blocked' })).toEqual({
      status: 'blocked',
    })
  })

  test('normalizes manufacturer profile payloads and parses status DTOs', () => {
    const payload = manufacturerProfileUpsertRequestSchema.parse({
      legalName: ' Tiny Bikes Ltd ',
      publicName: ' Tiny Bikes ',
      region: '',
      city: ' Москва ',
      phone: ' +7 999 000-00-00 ',
      email: ' MAKER@Example.COM ',
      description: ' Compact bicycles for circus acts ',
    })

    expect(payload).toEqual({
      legalName: 'Tiny Bikes Ltd',
      publicName: 'Tiny Bikes',
      region: null,
      city: 'Москва',
      phone: '+7 999 000-00-00',
      email: 'maker@example.com',
      description: 'Compact bicycles for circus acts',
    })

    const profile = manufacturerProfileSchema.parse({
      id: 'manufacturer_1',
      userId: 'user_1',
      legalName: 'Tiny Bikes Ltd',
      publicName: 'Tiny Bikes',
      region: null,
      city: 'Москва',
      phone: '+7 999 000-00-00',
      email: 'maker@example.com',
      description: 'Compact bicycles for circus acts',
      status: 'moderation',
      moderationComment: null,
      submittedAt: '2026-05-12T10:00:00.000Z',
      reviewedAt: null,
      createdAt: '2026-05-12T09:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
    })

    expect(profile.status).toBe('moderation')
  })

  test('rejects wrong-type manufacturer optional fields instead of dropping them', () => {
    expect(() =>
      manufacturerProfileUpsertRequestSchema.parse({
        legalName: 'Tiny Bikes Ltd',
        publicName: 'Tiny Bikes',
        region: 123,
        city: 'Москва',
        phone: '+7 999 000-00-00',
        email: 'maker@example.com',
        description: 'Compact bicycles for circus acts',
      }),
    ).toThrow()
  })

  test('requires moderation comments for rejected and blocked manufacturer decisions', () => {
    expect(() =>
      adminManufacturerStatusUpdateRequestSchema.parse({
        status: 'rejected',
      }),
    ).toThrow()

    expect(adminManufacturerStatusUpdateRequestSchema.parse({
      status: 'approved',
      moderationComment: '',
    })).toEqual({
      status: 'approved',
      moderationComment: null,
    })

    expect(manufacturerProfileSubmitResponseSchema.parse({
        profile: {
          id: 'manufacturer_1',
          userId: 'user_1',
          legalName: 'Tiny Bikes Ltd',
          publicName: 'Tiny Bikes',
          region: null,
          city: 'Москва',
          phone: '+7 999 000-00-00',
          email: 'maker@example.com',
          description: 'Compact bicycles for circus acts',
          status: 'moderation',
          moderationComment: null,
        submittedAt: '2026-05-12T10:00:00.000Z',
        reviewedAt: null,
        createdAt: '2026-05-12T09:00:00.000Z',
        updatedAt: '2026-05-12T10:00:00.000Z',
      },
    }).profile.status).toBe('moderation')
  })

  test('normalizes bicycle payloads and preserves money in kopecks', () => {
    const payload = bicycleUpsertRequestSchema.parse({
      title: ' Tiny Performer S ',
      description: ' Compact bicycle for controlled circus rehearsals. ',
      size: 'S',
      photoUrls: [' https://example.com/bike.jpg '],
      pricePerDayKopecks: '250000',
      depositKopecks: 500000,
      region: '',
      city: ' Москва ',
      pickupAddress: ' Main storage, door 2 ',
      deliveryAvailable: true,
      maxLoadKg: '12',
      seatHeightCm: 22,
      frameLengthCm: 40,
      wheelDiameterCm: 16,
      recommendedAnimalDimensions: 'Small trained animals up to 70 cm height',
      safetyNotes: 'Use only with trained handlers and indoor safety mats.',
    })

    expect(payload).toEqual({
      title: 'Tiny Performer S',
      description: 'Compact bicycle for controlled circus rehearsals.',
      size: 'S',
      photoUrls: ['https://example.com/bike.jpg'],
      pricePerDayKopecks: 250000,
      depositKopecks: 500000,
      region: null,
      city: 'Москва',
      pickupAddress: 'Main storage, door 2',
      deliveryAvailable: true,
      maxLoadKg: 12,
      seatHeightCm: 22,
      frameLengthCm: 40,
      wheelDiameterCm: 16,
      recommendedAnimalDimensions: 'Small trained animals up to 70 cm height',
      safetyNotes: 'Use only with trained handlers and indoor safety mats.',
    })

    expect(bicycleSchema.parse({
      id: 'bike_1',
      manufacturerProfileId: 'manufacturer_1',
      ...payload,
      status: 'moderation',
      moderationComment: null,
      submittedAt: '2026-05-12T10:00:00.000Z',
      reviewedAt: null,
      createdAt: '2026-05-12T09:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
    }).status).toBe('moderation')

    expect(adminBicycleSchema.parse({
      id: 'bike_1',
      manufacturerProfileId: 'manufacturer_1',
      ...payload,
      status: 'available',
      moderationComment: null,
      submittedAt: '2026-05-12T10:00:00.000Z',
      reviewedAt: '2026-05-12T11:00:00.000Z',
      createdAt: '2026-05-12T09:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
      manufacturer: {
        id: 'manufacturer_1',
        publicName: 'Tiny Bikes',
        city: 'Moscow',
        region: null,
        status: 'approved',
      },
    }).manufacturer.status).toBe('approved')
  })

  test('rejects unsafe bicycle payload and filter edge cases', () => {
    expect(() =>
      bicycleUpsertRequestSchema.parse({
        ...bicyclePayload('Tiny Performer S'),
        status: 'available',
      }),
    ).toThrow()

    expect(() =>
      bicycleUpsertRequestSchema.parse({
        ...bicyclePayload('Tiny Performer S'),
        photoUrls: ['not-a-url'],
      }),
    ).toThrow()

    expect(() =>
      publicBicyclesQuerySchema.parse({
        minPriceKopecks: 1_000_000,
        maxPriceKopecks: 100_000,
      }),
    ).toThrow()

    expect(() =>
      publicBicyclesQuerySchema.parse({
        startsOn: '2026-05-20',
      }),
    ).toThrow()

    expect(() =>
      publicBicyclesQuerySchema.parse({
        startsOn: '2026-02-30',
        endsOn: '2026-03-01',
      }),
    ).toThrow()

    expect(publicBicyclesQuerySchema.parse({
      sizes: 'S,M',
      startsOn: '2028-02-29',
      endsOn: '2028-03-01',
    }).sizes).toEqual(['S', 'M'])
  })

  test('requires moderation comments for rejected bicycle decisions', () => {
    expect(() =>
      adminBicycleModerationRequestSchema.parse({
        decision: 'rejected',
      }),
    ).toThrow()

    expect(adminBicycleModerationRequestSchema.parse({
      decision: 'approved',
      moderationComment: '',
    })).toEqual({
      decision: 'approved',
      moderationComment: null,
    })
  })

  test('normalizes order payloads and rejects client-side money injection', () => {
    const payload = orderCreateRequestSchema.parse({
      bicycleIds: [' bike_1 ', 'bike_2'],
      startsOn: '2026-05-12',
      endsOn: '2026-05-13',
      fulfillmentType: 'delivery',
      deliveryAddress: ' Circus arena, gate 4 ',
      contactName: ' Trainer ',
      contactPhone: ' +7 999 111-22-33 ',
      userComment: ' Keep the bicycles indoors. ',
      safetyAgreementAccepted: true,
    })

    expect(payload).toEqual({
      bicycleIds: ['bike_1', 'bike_2'],
      startsOn: '2026-05-12',
      endsOn: '2026-05-13',
      fulfillmentType: 'delivery',
      deliveryAddress: 'Circus arena, gate 4',
      contactName: 'Trainer',
      contactPhone: '+7 999 111-22-33',
      userComment: 'Keep the bicycles indoors.',
      safetyAgreementAccepted: true,
    })

    expect(() =>
      orderCreateRequestSchema.parse({
        ...payload,
        rentalAmountKopecks: 1,
      }),
    ).toThrow()

    expect(() =>
      orderCreateRequestSchema.parse({
        ...payload,
        bicycleIds: ['bike_1', 'bike_1'],
      }),
    ).toThrow()

    expect(() =>
      orderCreateRequestSchema.parse({
        ...payload,
        startsOn: '2026-02-30',
      }),
    ).toThrow()

    expect(() =>
      orderCreateRequestSchema.parse({
        ...payload,
        startsOn: '2026-05-14',
      }),
    ).toThrow()

    expect(() =>
      orderCreateRequestSchema.parse({
        ...payload,
        fulfillmentType: 'pickup',
        deliveryAddress: null,
        endsOn: '2027-05-13',
      }),
    ).toThrow()

    expect(() =>
      orderCreateRequestSchema.parse({
        ...payload,
        fulfillmentType: 'pickup',
      }),
    ).toThrow()

    expect(() =>
      orderCreateRequestSchema.parse({
        ...payload,
        safetyAgreementAccepted: false,
      }),
    ).toThrow()

    const publicOrder = orderSchema.parse({
      id: 'order_1',
      userId: 'user_1',
      status: 'request',
      startsOn: '2026-05-12',
      endsOn: '2026-05-13',
      rentalDays: 2,
      fulfillmentType: 'delivery',
      deliveryAddress: 'Circus arena, gate 4',
      contactName: 'Trainer',
      contactPhone: '+7 999 111-22-33',
      userComment: 'Keep the bicycles indoors.',
      rentalAmountKopecks: 700000,
      depositAmountKopecks: 700000,
      deliveryAmountKopecks: 0,
      totalAmountKopecks: 1400000,
      safetyAgreementAcceptedAt: '2026-05-12T10:00:00.000Z',
      createdAt: '2026-05-12T10:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
      payments: [],
      paymentRequirementsMet: false,
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
            manufacturer: {
              id: 'manufacturer_1',
              publicName: 'Tiny Bikes',
              city: 'Moscow',
              region: null,
            },
          },
        },
      ],
    })
    expect(publicOrder.items[0]?.pricePerDaySnapshotKopecks).toBe(250000)
    expect('adminComment' in publicOrder).toBe(false)

    const payment = paymentSchema.parse({
      id: 'payment_1',
      orderId: 'order_1',
      type: 'rent',
      provider: 'stub',
      status: 'pending',
      amountKopecks: 700000,
      currency: 'RUB',
      providerPaymentId: 'stub_payment_1',
      failureReason: null,
      completedAt: null,
      createdAt: '2026-05-12T10:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
    })
    expect(payment.type).toBe('rent')
    expect(paymentResponseSchema.parse({ payment }).payment.status).toBe('pending')
  })

  test('normalizes order status transition contracts and domain error codes', () => {
    expect(ordersQuerySchema.parse({ scope: 'current', pageSize: 10 })).toEqual({
      page: 1,
      pageSize: 10,
      scope: 'current',
    })
    expect(ordersQuerySchema.parse({ scope: 'history', status: 'returned' }).status).toBe('returned')
    expect(() =>
      ordersQuerySchema.parse({
        scope: 'current',
        status: 'returned',
      }),
    ).toThrow()
    expect(() =>
      adminOrdersQuerySchema.parse({
        scope: 'current',
      }),
    ).toThrow()

    expect(orderCancelRequestSchema.parse({ comment: ' Customer schedule changed. ' })).toEqual({
      comment: 'Customer schedule changed.',
    })
    expect(orderCancelRequestSchema.parse({})).toEqual({ comment: null })

    expect(adminOrderStatusUpdateRequestSchema.parse({
      status: 'confirmed',
      comment: '',
    })).toEqual({
      status: 'confirmed',
      comment: null,
      checklists: [],
    })
    expect(() =>
      adminOrderStatusUpdateRequestSchema.parse({
        status: 'confirmed',
        checklists: [
          {
            bicycleId: 'bike_1',
            frameCondition: 'ok',
            wheelsCondition: 'ok',
            handlebarCondition: 'ok',
            saddleCondition: 'ok',
            brakesCondition: 'not_applicable',
            exteriorCondition: 'ok',
          },
        ],
      }),
    ).toThrow()

    expect(adminOrderStatusUpdateRequestSchema.parse({
      status: 'cancelled',
      comment: 'Unavailable on requested dates.',
    }).comment).toBe('Unavailable on requested dates.')

    expect(() =>
      adminOrderStatusUpdateRequestSchema.parse({
        status: 'cancelled',
      }),
    ).toThrow()

    const issueTransition = adminOrderStatusUpdateRequestSchema.parse({
      status: 'issued',
      checklists: [
        {
          bicycleId: 'bike_1',
          frameCondition: 'ok',
          wheelsCondition: 'ok',
          handlebarCondition: 'ok',
          saddleCondition: 'ok',
          brakesCondition: 'not_applicable',
          exteriorCondition: 'worn',
          comment: 'Ready for handoff.',
        },
      ],
    })
    expect(issueTransition.checklists[0]?.safetyAction).toBe('none')
    expect(() =>
      adminOrderStatusUpdateRequestSchema.parse({
        status: 'issued',
        checklists: [
          {
            bicycleId: 'bike_1',
            frameCondition: 'ok',
            wheelsCondition: 'ok',
            handlebarCondition: 'ok',
            saddleCondition: 'ok',
            brakesCondition: 'not_applicable',
            exteriorCondition: 'ok',
            safetyAction: 'maintenance',
          },
        ],
      }),
    ).toThrow()
    expect(adminOrderChecklistInputSchema.parse({
      bicycleId: ' bike_1 ',
      frameCondition: 'ok',
      wheelsCondition: 'ok',
      handlebarCondition: 'ok',
      saddleCondition: 'ok',
      brakesCondition: 'not_applicable',
      exteriorCondition: 'unsafe',
      safetyAction: 'maintenance',
      comment: '',
    })).toEqual({
      bicycleId: 'bike_1',
      frameCondition: 'ok',
      wheelsCondition: 'ok',
      handlebarCondition: 'ok',
      saddleCondition: 'ok',
      brakesCondition: 'not_applicable',
      exteriorCondition: 'unsafe',
      safetyAction: 'maintenance',
      comment: null,
    })
    expect(() =>
      adminOrderStatusUpdateRequestSchema.parse({
        status: 'returned',
        checklists: [],
      }),
    ).toThrow()

    expect(apiErrorCodeSchema.parse('ORDER_AVAILABILITY_CONFLICT')).toBe(
      'ORDER_AVAILABILITY_CONFLICT',
    )
    expect(apiErrorCodeSchema.parse('PAYMENT_REQUIREMENTS_NOT_MET')).toBe(
      'PAYMENT_REQUIREMENTS_NOT_MET',
    )

    const adminOrder = adminOrderSchema.parse({
      id: 'order_1',
      userId: 'user_1',
      status: 'request',
      startsOn: '2026-05-12',
      endsOn: '2026-05-13',
      rentalDays: 2,
      fulfillmentType: 'delivery',
      deliveryAddress: 'Circus arena, gate 4',
      contactName: 'Trainer',
      contactPhone: '+7 999 111-22-33',
      userComment: 'Keep the bicycles indoors.',
      adminComment: null,
      rentalAmountKopecks: 700000,
      depositAmountKopecks: 700000,
      deliveryAmountKopecks: 0,
      totalAmountKopecks: 1400000,
      safetyAgreementAcceptedAt: '2026-05-12T10:00:00.000Z',
      createdAt: '2026-05-12T10:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
      payments: [
        {
          id: 'payment_1',
          orderId: 'order_1',
          type: 'rent',
          provider: 'stub',
          status: 'succeeded',
          amountKopecks: 700000,
          currency: 'RUB',
          providerPaymentId: 'stub_payment_1',
          failureReason: null,
          completedAt: '2026-05-12T10:05:00.000Z',
          createdAt: '2026-05-12T10:00:00.000Z',
          updatedAt: '2026-05-12T10:05:00.000Z',
        },
        {
          id: 'payment_2',
          orderId: 'order_1',
          type: 'deposit',
          provider: 'stub',
          status: 'succeeded',
          amountKopecks: 700000,
          currency: 'RUB',
          providerPaymentId: 'stub_payment_2',
          failureReason: null,
          completedAt: '2026-05-12T10:06:00.000Z',
          createdAt: '2026-05-12T10:00:00.000Z',
          updatedAt: '2026-05-12T10:06:00.000Z',
        },
      ],
      paymentRequirementsMet: true,
      user: {
        id: 'user_1',
        email: 'renter@example.com',
        displayName: 'Renter',
        status: 'active',
      },
      statusHistory: [
        {
          id: 'history_1',
          orderId: 'order_1',
          fromStatus: 'request',
          toStatus: 'confirmed',
          changedByUserId: 'admin_1',
          changedByUser: {
            id: 'admin_1',
            email: 'admin@example.com',
            displayName: 'Admin',
            status: 'active',
          },
          comment: 'Approved.',
          createdAt: '2026-05-12T11:00:00.000Z',
        },
      ],
      checklists: [
        {
          id: 'checklist_1',
          orderId: 'order_1',
          bicycleId: 'bike_1',
          type: 'issue',
          frameCondition: 'ok',
          wheelsCondition: 'ok',
          handlebarCondition: 'ok',
          saddleCondition: 'ok',
          brakesCondition: 'not_applicable',
          exteriorCondition: 'worn',
          safetyAction: 'none',
          comment: 'Ready for handoff.',
          checkedByUserId: 'admin_1',
          checkedByUser: {
            id: 'admin_1',
            email: 'admin@example.com',
            displayName: 'Admin',
            status: 'active',
          },
          checkedAt: '2026-05-12T11:05:00.000Z',
          createdAt: '2026-05-12T11:05:00.000Z',
          updatedAt: '2026-05-12T11:05:00.000Z',
        },
      ],
      availabilityWarnings: [
        {
          type: 'technical_limits',
          severity: 'info',
          bicycleId: 'bike_1',
          bicycleTitle: 'Tiny Performer S',
          conflictingOrderId: null,
          message: 'Review technical limits before confirmation.',
        },
      ],
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
            manufacturer: {
              id: 'manufacturer_1',
              publicName: 'Tiny Bikes',
              city: 'Moscow',
              region: null,
            },
          },
          liveBicycle: {
            id: 'bike_1',
            status: 'available',
            deliveryAvailable: true,
            manufacturerStatus: 'approved',
            maxLoadKg: 12,
            seatHeightCm: 22,
            frameLengthCm: 40,
            wheelDiameterCm: 16,
            recommendedAnimalDimensions: 'Small trained animals up to 70 cm height',
            safetyNotes: 'Use only with trained handlers and indoor safety mats.',
          },
        },
      ],
    })

    expect(adminOrder.statusHistory[0]?.toStatus).toBe('confirmed')
    expect(manufacturerOrdersQuerySchema.parse({ scope: 'current', status: 'issued' })).toMatchObject({
      scope: 'current',
      status: 'issued',
    })

    const manufacturerOrder = manufacturerOrderSchema.parse({
      id: 'order_1',
      status: 'issued',
      startsOn: '2026-05-12',
      endsOn: '2026-05-13',
      rentalDays: 2,
      fulfillmentType: 'delivery',
      fulfillmentContact: {
        contactName: 'Trainer',
        contactPhone: '+7 999 111-22-33',
        deliveryAddress: 'Circus arena, gate 4',
        userComment: 'Keep the bicycles indoors.',
      },
      manufacturerRentalAmountKopecks: 500000,
      manufacturerDepositAmountKopecks: 500000,
      manufacturerTotalAmountKopecks: 1000000,
      createdAt: '2026-05-12T10:00:00.000Z',
      updatedAt: '2026-05-12T11:05:00.000Z',
      items: adminOrder.items.map(({ liveBicycle: _liveBicycle, ...item }) => item),
      checklists: adminOrder.checklists.map(({
        checkedByUser: _checkedByUser,
        checkedByUserId: _checkedByUserId,
        ...checklist
      }) => checklist),
    })
    expect('adminComment' in manufacturerOrder).toBe(false)
    expect('payments' in manufacturerOrder).toBe(false)
    expect('userId' in manufacturerOrder).toBe(false)
    expect('checkedBy' in manufacturerOrder.checklists[0]!).toBe(false)
  })
})

function bicyclePayload(title: string) {
  return {
    title,
    description: 'Compact bicycle for controlled circus rehearsals.',
    size: 'S',
    photoUrls: ['https://example.com/bike.jpg'],
    pricePerDayKopecks: 250000,
    depositKopecks: 500000,
    region: null,
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
