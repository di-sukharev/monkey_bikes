import type {
  OrderCreateRequest,
  OrderDto,
  OrdersQuery,
  OrderStatus,
} from '@web-app-demo/contracts'
import {
  maxOrderAmountKopecks,
  maxOrderRentalDays,
  rentalDaysInclusive as contractRentalDaysInclusive,
} from '@web-app-demo/contracts'

import type { AuthenticatedUser } from '../auth/service'
import type { DbClient } from '../db'
import { AppError } from '../http/errors'

type BicycleForOrderRecord = {
  id: string
  title: string
  size: 'S' | 'M' | 'L'
  city: string
  pickupAddress: string
  deliveryAvailable: boolean
  pricePerDayKopecks: number
  depositKopecks: number
  manufacturerProfile: {
    id: string
    publicName: string
    region: string | null
    city: string
  }
}

type OrderItemRecord = {
  id: string
  orderId: string
  bicycleId: string
  pricePerDaySnapshotKopecks: number
  depositSnapshotKopecks: number
  bicycleTitleSnapshot: string
  bicycleSizeSnapshot: 'S' | 'M' | 'L'
  bicycleCitySnapshot: string
  bicyclePickupAddressSnapshot: string
  bicycleDeliveryAvailableSnapshot: boolean
  manufacturerProfileIdSnapshot: string
  manufacturerPublicNameSnapshot: string
  manufacturerRegionSnapshot: string | null
  manufacturerCitySnapshot: string
  createdAt: Date
}

type OrderRecord = {
  id: string
  userId: string
  status: OrderStatus
  startsOn: string
  endsOn: string
  rentalDays: number
  fulfillmentType: 'delivery' | 'pickup'
  deliveryAddress: string | null
  contactName: string
  contactPhone: string
  userComment: string | null
  adminComment: string | null
  rentalAmountKopecks: number
  depositAmountKopecks: number
  deliveryAmountKopecks: number
  totalAmountKopecks: number
  safetyAgreementAcceptedAt: Date
  createdAt: Date
  updatedAt: Date
  items: OrderItemRecord[]
}

const orderInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
  },
}

export class OrderService {
  constructor(private readonly db: DbClient) {}

  async createOrder(user: AuthenticatedUser, input: OrderCreateRequest) {
    const rentalDays = rentalDaysInclusive(input.startsOn, input.endsOn)
    if (rentalDays > maxOrderRentalDays) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Rental period must be ${maxOrderRentalDays} days or less`,
      )
    }

    const order = await this.db.$transaction(async (tx) => {
      const bicycles = await tx.bicycle.findMany({
        where: {
          id: { in: input.bicycleIds },
          status: 'available',
          manufacturerProfile: { is: { status: 'approved' } },
        },
        include: {
          manufacturerProfile: true,
        },
      })

      if (bicycles.length !== input.bicycleIds.length) {
        throw new AppError(409, 'CONFLICT', 'All bicycles must be available for rental requests')
      }

      const bicyclesById = new Map(bicycles.map((bicycle) => [bicycle.id, bicycle]))
      const orderedBicycles = input.bicycleIds.map((id) => bicyclesById.get(id))

      if (orderedBicycles.some((bicycle) => bicycle === undefined)) {
        throw new AppError(409, 'CONFLICT', 'All bicycles must be available for rental requests')
      }

      if (
        input.fulfillmentType === 'delivery' &&
        orderedBicycles.some((bicycle) => bicycle?.deliveryAvailable !== true)
      ) {
        throw new AppError(409, 'CONFLICT', 'Delivery is not available for every selected bicycle')
      }

      const rentalAmountKopecks = orderedBicycles.reduce(
        (total, bicycle) => total + bicycle!.pricePerDayKopecks * rentalDays,
        0,
      )
      const depositAmountKopecks = orderedBicycles.reduce(
        (total, bicycle) => total + bicycle!.depositKopecks,
        0,
      )
      const deliveryAmountKopecks = 0
      const totalAmountKopecks = rentalAmountKopecks + depositAmountKopecks + deliveryAmountKopecks
      assertOrderMoneyFits('Rental amount', rentalAmountKopecks)
      assertOrderMoneyFits('Deposit amount', depositAmountKopecks)
      assertOrderMoneyFits('Delivery amount', deliveryAmountKopecks)
      assertOrderMoneyFits('Total amount', totalAmountKopecks)

      const created = await tx.order.create({
        data: {
          userId: user.id,
          status: 'request',
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          rentalDays,
          fulfillmentType: input.fulfillmentType,
          deliveryAddress: input.fulfillmentType === 'delivery' ? input.deliveryAddress : null,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          userComment: input.userComment,
          rentalAmountKopecks,
          depositAmountKopecks,
          deliveryAmountKopecks,
          totalAmountKopecks,
          safetyAgreementAcceptedAt: new Date(),
          items: {
            create: orderedBicycles.map((bicycle) => ({
              bicycleId: bicycle!.id,
              pricePerDaySnapshotKopecks: bicycle!.pricePerDayKopecks,
              depositSnapshotKopecks: bicycle!.depositKopecks,
              bicycleTitleSnapshot: bicycle!.title,
              bicycleSizeSnapshot: bicycle!.size,
              bicycleCitySnapshot: bicycle!.city,
              bicyclePickupAddressSnapshot: bicycle!.pickupAddress,
              bicycleDeliveryAvailableSnapshot: bicycle!.deliveryAvailable,
              manufacturerProfileIdSnapshot: bicycle!.manufacturerProfile.id,
              manufacturerPublicNameSnapshot: bicycle!.manufacturerProfile.publicName,
              manufacturerRegionSnapshot: bicycle!.manufacturerProfile.region,
              manufacturerCitySnapshot: bicycle!.manufacturerProfile.city,
            })),
          },
        },
      })

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: orderInclude,
      })
    })

    return {
      order: toOrderDto(order),
    }
  }

  async listCurrentUserOrders(user: AuthenticatedUser, query: OrdersQuery) {
    const where = {
      userId: user.id,
      ...(query.status ? { status: query.status } : {}),
    }
    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.db.$transaction([
      this.db.order.findMany({
        where,
        include: orderInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.db.order.count({ where }),
    ])

    return {
      items: items.map(toOrderDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async getCurrentUserOrder(user: AuthenticatedUser, id: string) {
    const order = await this.db.order.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: orderInclude,
    })

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', 'Order not found')
    }

    return {
      order: toOrderDto(order),
    }
  }
}

export function rentalDaysInclusive(startsOn: string, endsOn: string) {
  return contractRentalDaysInclusive(startsOn, endsOn)
}

function assertOrderMoneyFits(label: string, amountKopecks: number) {
  if (
    !Number.isSafeInteger(amountKopecks) ||
    amountKopecks < 0 ||
    amountKopecks > maxOrderAmountKopecks
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${label} exceeds the maximum supported amount`,
    )
  }
}

function toOrderDto(order: OrderRecord): OrderDto {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    startsOn: order.startsOn,
    endsOn: order.endsOn,
    rentalDays: order.rentalDays,
    fulfillmentType: order.fulfillmentType,
    deliveryAddress: order.deliveryAddress,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    userComment: order.userComment,
    adminComment: order.adminComment,
    rentalAmountKopecks: order.rentalAmountKopecks,
    depositAmountKopecks: order.depositAmountKopecks,
    deliveryAmountKopecks: order.deliveryAmountKopecks,
    totalAmountKopecks: order.totalAmountKopecks,
    safetyAgreementAcceptedAt: order.safetyAgreementAcceptedAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map(toOrderItemDto),
  }
}

function toOrderItemDto(item: OrderItemRecord) {
  return {
    id: item.id,
    orderId: item.orderId,
    bicycleId: item.bicycleId,
    pricePerDaySnapshotKopecks: item.pricePerDaySnapshotKopecks,
    depositSnapshotKopecks: item.depositSnapshotKopecks,
    createdAt: item.createdAt.toISOString(),
    bicycle: {
      id: item.bicycleId,
      title: item.bicycleTitleSnapshot,
      size: item.bicycleSizeSnapshot,
      city: item.bicycleCitySnapshot,
      deliveryAvailable: item.bicycleDeliveryAvailableSnapshot,
      pickupAddress: item.bicyclePickupAddressSnapshot,
      manufacturer: {
        id: item.manufacturerProfileIdSnapshot,
        publicName: item.manufacturerPublicNameSnapshot,
        region: item.manufacturerRegionSnapshot,
        city: item.manufacturerCitySnapshot,
      },
    },
  }
}
