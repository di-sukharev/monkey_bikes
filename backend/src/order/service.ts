import type {
  AdminOrderDto,
  AdminOrdersQuery,
  AdminOrderStatusUpdateRequest,
  AdminOrderWarningDto,
  OrderCancelRequest,
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
import { Prisma } from '../generated/prisma/client'
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

type LiveBicycleForAdminRecord = {
  id: string
  status: 'archived' | 'available' | 'draft' | 'hidden' | 'maintenance' | 'moderation' | 'rejected' | 'rented' | 'reserved'
  deliveryAvailable: boolean
  maxLoadKg: number
  seatHeightCm: number
  frameLengthCm: number
  wheelDiameterCm: number
  recommendedAnimalDimensions: string
  safetyNotes: string
  manufacturerProfile: {
    status: 'approved' | 'blocked' | 'draft' | 'moderation' | 'rejected'
  }
}

type AdminOrderItemRecord = OrderItemRecord & {
  bicycle: LiveBicycleForAdminRecord
}

type OrderUserSummaryRecord = {
  id: string
  email: string
  displayName: string | null
  status: 'active' | 'blocked'
}

type OrderStatusHistoryRecord = {
  id: string
  orderId: string
  fromStatus: OrderStatus
  toStatus: OrderStatus
  changedByUserId: string
  changedByUser: OrderUserSummaryRecord
  comment: string | null
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

type AdminOrderRecord = Omit<OrderRecord, 'items'> & {
  user: OrderUserSummaryRecord
  items: AdminOrderItemRecord[]
  statusHistory: OrderStatusHistoryRecord[]
}

type AvailabilityConflict = {
  bicycleId: string
  bicycleTitle: string
  conflictingOrderId: string
  startsOn: string
  endsOn: string
  status: 'confirmed' | 'issued'
}

const orderTransitionMaxAttempts = 3
const orderInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
  },
}
const orderUserSummarySelect = {
  id: true,
  email: true,
  displayName: true,
  status: true,
} as const
const adminOrderInclude = {
  user: {
    select: orderUserSummarySelect,
  },
  items: {
    include: {
      bicycle: {
        include: {
          manufacturerProfile: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  statusHistory: {
    include: {
      changedByUser: {
        select: orderUserSummarySelect,
      },
    },
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

  async cancelCurrentUserOrder(user: AuthenticatedUser, id: string, input: OrderCancelRequest) {
    const order = await this.runOrderTransition(async (tx) => {
      const current = await tx.order.findFirst({
        where: {
          id,
          userId: user.id,
        },
      })

      if (!current) {
        throw new AppError(404, 'NOT_FOUND', 'Order not found')
      }

      if (current.status !== 'request') {
        throw new AppError(
          409,
          'ORDER_NOT_CANCELLABLE',
          'Only rental requests can be cancelled by the customer',
        )
      }

      const updated = await tx.order.updateMany({
        where: {
          id: current.id,
          status: 'request',
        },
        data: {
          status: 'cancelled',
        },
      })

      if (updated.count !== 1) {
        throw new AppError(
          409,
          'ORDER_NOT_CANCELLABLE',
          'Order status changed before it could be cancelled',
        )
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: current.id,
          fromStatus: 'request',
          toStatus: 'cancelled',
          changedByUserId: user.id,
          comment: input.comment,
        },
      })

      return tx.order.findUniqueOrThrow({
        where: { id: current.id },
        include: orderInclude,
      })
    })

    return {
      order: toOrderDto(order),
    }
  }

  async listAdminOrders(query: AdminOrdersQuery) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
    }
    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.db.$transaction([
      this.db.order.findMany({
        where,
        include: adminOrderInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.db.order.count({ where }),
    ])

    const orderDtos: AdminOrderDto[] = []
    for (const order of items) {
      orderDtos.push(await this.toAdminOrderDto(order))
    }

    return {
      items: orderDtos,
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async getAdminOrder(id: string) {
    const order = await this.db.order.findUnique({
      where: { id },
      include: adminOrderInclude,
    })

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', 'Order not found')
    }

    return {
      order: await this.toAdminOrderDto(order),
    }
  }

  async updateAdminOrderStatus(
    actor: AuthenticatedUser,
    id: string,
    input: AdminOrderStatusUpdateRequest,
  ) {
    if (input.status === 'confirmed') {
      return this.confirmAdminOrder(actor, id, input)
    }

    return this.cancelAdminOrder(actor, id, input)
  }

  private async confirmAdminOrder(
    actor: AuthenticatedUser,
    id: string,
    input: AdminOrderStatusUpdateRequest,
  ) {
    const order = await this.runOrderTransition(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        include: adminOrderInclude,
      })

      if (!current) {
        throw new AppError(404, 'NOT_FOUND', 'Order not found')
      }

      if (current.status !== 'request') {
        throw new AppError(
          409,
          'ORDER_STATUS_TRANSITION_NOT_ALLOWED',
          'Only rental requests can be confirmed',
        )
      }

      const liveBicycles = await lockOrderBicycles(tx, current.items.map((item) => item.bicycleId))
      const unavailableWarnings = buildLiveAvailabilityWarnings(current, liveBicycles)
        .filter((warning) => warning.severity === 'error')

      if (unavailableWarnings.length > 0) {
        throw new AppError(
          409,
          'BICYCLE_NOT_AVAILABLE',
          'Selected bicycles are no longer available for confirmation',
          { warnings: unavailableWarnings },
        )
      }

      const conflicts = await findAvailabilityConflicts(tx, current)
      if (conflicts.length > 0) {
        throw new AppError(
          409,
          'ORDER_AVAILABILITY_CONFLICT',
          'Selected bicycles are unavailable for these dates',
          { conflicts },
        )
      }

      const updated = await tx.order.updateMany({
        where: {
          id: current.id,
          status: 'request',
        },
        data: {
          status: 'confirmed',
          adminComment: input.comment,
        },
      })

      if (updated.count !== 1) {
        throw new AppError(
          409,
          'ORDER_STATUS_TRANSITION_NOT_ALLOWED',
          'Order status changed before it could be confirmed',
        )
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: current.id,
          fromStatus: 'request',
          toStatus: 'confirmed',
          changedByUserId: actor.id,
          comment: input.comment,
        },
      })

      return tx.order.findUniqueOrThrow({
        where: { id: current.id },
        include: adminOrderInclude,
      })
    })

    return {
      order: await this.toAdminOrderDto(order),
    }
  }

  private async cancelAdminOrder(
    actor: AuthenticatedUser,
    id: string,
    input: AdminOrderStatusUpdateRequest,
  ) {
    const order = await this.runOrderTransition(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
      })

      if (!current) {
        throw new AppError(404, 'NOT_FOUND', 'Order not found')
      }

      if (current.status !== 'request') {
        throw new AppError(
          409,
          'ORDER_STATUS_TRANSITION_NOT_ALLOWED',
          'Only rental requests can be cancelled by an administrator in this flow',
        )
      }

      const updated = await tx.order.updateMany({
        where: {
          id: current.id,
          status: 'request',
        },
        data: {
          status: 'cancelled',
          adminComment: input.comment,
        },
      })

      if (updated.count !== 1) {
        throw new AppError(
          409,
          'ORDER_STATUS_TRANSITION_NOT_ALLOWED',
          'Order status changed before it could be cancelled',
        )
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: current.id,
          fromStatus: 'request',
          toStatus: 'cancelled',
          changedByUserId: actor.id,
          comment: input.comment,
        },
      })

      return tx.order.findUniqueOrThrow({
        where: { id: current.id },
        include: adminOrderInclude,
      })
    })

    return {
      order: await this.toAdminOrderDto(order),
    }
  }

  private async runOrderTransition<T>(
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    for (let attempt = 1; attempt <= orderTransitionMaxAttempts; attempt += 1) {
      try {
        return await this.db.$transaction(action, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        })
      } catch (error) {
        if (isTransactionConflict(error) && attempt < orderTransitionMaxAttempts) {
          continue
        }

        if (isTransactionConflict(error)) {
          throw new AppError(409, 'CONFLICT', 'Concurrent order status update conflict')
        }

        throw error
      }
    }

    throw new AppError(409, 'CONFLICT', 'Concurrent order status update conflict')
  }

  private async toAdminOrderDto(order: AdminOrderRecord): Promise<AdminOrderDto> {
    return {
      ...toOrderDto(order),
      user: order.user,
      items: order.items.map(toAdminOrderItemDto),
      statusHistory: order.statusHistory.map(toOrderStatusHistoryDto),
      availabilityWarnings: await this.availabilityWarnings(order),
    }
  }

  private async availabilityWarnings(order: AdminOrderRecord) {
    const conflicts = await findAvailabilityConflicts(this.db, order)
    return [
      ...buildLiveAvailabilityWarnings(order, order.items.map((item) => item.bicycle)),
      ...conflicts.map((conflict): AdminOrderWarningDto => ({
        type: 'availability_conflict',
        severity: 'error',
        bicycleId: conflict.bicycleId,
        bicycleTitle: conflict.bicycleTitle,
        conflictingOrderId: conflict.conflictingOrderId,
        message: `${conflict.bicycleTitle} conflicts with order ${conflict.conflictingOrderId} (${conflict.startsOn} - ${conflict.endsOn}).`,
      })),
      ...order.items.map((item): AdminOrderWarningDto => ({
        type: 'technical_limits',
        severity: 'info',
        bicycleId: item.bicycleId,
        bicycleTitle: item.bicycleTitleSnapshot,
        conflictingOrderId: null,
        message: `${item.bicycleTitleSnapshot}: max load ${item.bicycle.maxLoadKg} kg, seat ${item.bicycle.seatHeightCm} cm, frame ${item.bicycle.frameLengthCm} cm, wheel ${item.bicycle.wheelDiameterCm} cm. ${item.bicycle.recommendedAnimalDimensions}. ${item.bicycle.safetyNotes}`,
      })),
    ]
  }
}

export function rentalDaysInclusive(startsOn: string, endsOn: string) {
  return contractRentalDaysInclusive(startsOn, endsOn)
}

export function rentalPeriodsOverlap(
  existingStartsOn: string,
  existingEndsOn: string,
  requestedStartsOn: string,
  requestedEndsOn: string,
) {
  return existingStartsOn <= requestedEndsOn && existingEndsOn >= requestedStartsOn
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

async function lockOrderBicycles(
  tx: Prisma.TransactionClient,
  bicycleIds: string[],
) {
  const uniqueSortedIds = [...new Set(bicycleIds)].sort()
  const lockedBicycles = []

  for (const id of uniqueSortedIds) {
    lockedBicycles.push(await tx.bicycle.update({
      where: { id },
      data: {
        availabilityLockVersion: {
          increment: 1,
        },
      },
      include: {
        manufacturerProfile: true,
      },
    }))
  }

  return lockedBicycles
}

function buildLiveAvailabilityWarnings(
  order: Pick<AdminOrderRecord, 'fulfillmentType' | 'items'>,
  liveBicycles: LiveBicycleForAdminRecord[],
) {
  const itemsByBicycleId = new Map(order.items.map((item) => [item.bicycleId, item]))
  const warnings: AdminOrderWarningDto[] = []

  for (const bicycle of liveBicycles) {
    const item = itemsByBicycleId.get(bicycle.id)
    const bicycleTitle = item?.bicycleTitleSnapshot ?? null

    if (bicycle.status !== 'available') {
      warnings.push({
        type: 'bicycle_status',
        severity: 'error',
        bicycleId: bicycle.id,
        bicycleTitle,
        conflictingOrderId: null,
        message: `${bicycleTitle ?? 'Selected bicycle'} is currently ${bicycle.status}.`,
      })
    }

    if (bicycle.manufacturerProfile.status !== 'approved') {
      warnings.push({
        type: 'manufacturer_status',
        severity: 'error',
        bicycleId: bicycle.id,
        bicycleTitle,
        conflictingOrderId: null,
        message: `${bicycleTitle ?? 'Selected bicycle'} belongs to a ${bicycle.manufacturerProfile.status} manufacturer.`,
      })
    }

    if (order.fulfillmentType === 'delivery' && !bicycle.deliveryAvailable) {
      warnings.push({
        type: 'delivery_unavailable',
        severity: 'error',
        bicycleId: bicycle.id,
        bicycleTitle,
        conflictingOrderId: null,
        message: `${bicycleTitle ?? 'Selected bicycle'} no longer supports delivery.`,
      })
    }
  }

  return warnings
}

async function findAvailabilityConflicts(
  db: Pick<DbClient, 'order'> | Prisma.TransactionClient,
  order: Pick<AdminOrderRecord, 'id' | 'startsOn' | 'endsOn' | 'items'>,
): Promise<AvailabilityConflict[]> {
  const requestedBicycleIds = order.items.map((item) => item.bicycleId)
  const requestedItemsByBicycleId = new Map(order.items.map((item) => [item.bicycleId, item]))
  const conflictingOrders = await db.order.findMany({
    where: {
      id: { not: order.id },
      status: { in: ['confirmed', 'issued'] },
      startsOn: { lte: order.endsOn },
      endsOn: { gte: order.startsOn },
      items: {
        some: {
          bicycleId: { in: requestedBicycleIds },
        },
      },
    },
    select: {
      id: true,
      startsOn: true,
      endsOn: true,
      status: true,
      items: {
        where: {
          bicycleId: { in: requestedBicycleIds },
        },
        select: {
          bicycleId: true,
          bicycleTitleSnapshot: true,
        },
      },
    },
    orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
  })

  return conflictingOrders.flatMap((conflictingOrder) =>
    conflictingOrder.items.map((item) => ({
      bicycleId: item.bicycleId,
      bicycleTitle:
        requestedItemsByBicycleId.get(item.bicycleId)?.bicycleTitleSnapshot ??
        item.bicycleTitleSnapshot,
      conflictingOrderId: conflictingOrder.id,
      startsOn: conflictingOrder.startsOn,
      endsOn: conflictingOrder.endsOn,
      status: conflictingOrder.status as 'confirmed' | 'issued',
    })),
  )
}

function toAdminOrderItemDto(item: AdminOrderItemRecord) {
  return {
    ...toOrderItemDto(item),
    liveBicycle: {
      id: item.bicycle.id,
      status: item.bicycle.status,
      deliveryAvailable: item.bicycle.deliveryAvailable,
      manufacturerStatus: item.bicycle.manufacturerProfile.status,
      maxLoadKg: item.bicycle.maxLoadKg,
      seatHeightCm: item.bicycle.seatHeightCm,
      frameLengthCm: item.bicycle.frameLengthCm,
      wheelDiameterCm: item.bicycle.wheelDiameterCm,
      recommendedAnimalDimensions: item.bicycle.recommendedAnimalDimensions,
      safetyNotes: item.bicycle.safetyNotes,
    },
  }
}

function toOrderStatusHistoryDto(history: OrderStatusHistoryRecord) {
  return {
    id: history.id,
    orderId: history.orderId,
    fromStatus: history.fromStatus,
    toStatus: history.toStatus,
    changedByUserId: history.changedByUserId,
    changedByUser: history.changedByUser,
    comment: history.comment,
    createdAt: history.createdAt.toISOString(),
  }
}

function isTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
    return true
  }

  if (!error || typeof error !== 'object' || !('cause' in error)) {
    return false
  }

  const cause = error.cause
  if (!cause || typeof cause !== 'object') {
    return false
  }

  return (
    ('kind' in cause && cause.kind === 'TransactionWriteConflict') ||
    ('originalCode' in cause && cause.originalCode === '40001')
  )
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
