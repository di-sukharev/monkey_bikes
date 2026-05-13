import type {
  AdminBicycleModerationPayload,
  AdminBicyclesQuery,
  AdminBicycleStatusUpdateRequest,
  BicycleDto,
  BicycleStatus,
  BicycleUpsertRequest,
  ManufacturerBicyclesQuery,
  PublicBicyclesQuery,
} from '@web-app-demo/contracts'

import type { AuthenticatedUser } from '../auth/service'
import type { DbClient } from '../db'
import type { Prisma } from '../generated/prisma/client'
import { AppError } from '../http/errors'

type BicycleRecord = {
  id: string
  manufacturerProfileId: string
  title: string
  description: string
  size: 'S' | 'M' | 'L'
  photoUrls: string[]
  pricePerDayKopecks: number
  depositKopecks: number
  status: BicycleStatus
  moderationComment: string | null
  submittedAt: Date | null
  reviewedAt: Date | null
  region: string | null
  city: string
  pickupAddress: string
  deliveryAvailable: boolean
  maxLoadKg: number
  seatHeightCm: number
  frameLengthCm: number
  wheelDiameterCm: number
  recommendedAnimalDimensions: string
  safetyNotes: string
  createdAt: Date
  updatedAt: Date
}

type ManufacturerProfileRecord = {
  id: string
  userId: string
  publicName: string
  region: string | null
  city: string
  status: 'approved' | 'blocked' | 'draft' | 'moderation' | 'rejected'
}

type BicycleWithManufacturerRecord = BicycleRecord & {
  manufacturerProfile: ManufacturerProfileRecord
}

const producerEditableStatuses: BicycleStatus[] = ['available', 'draft', 'moderation', 'rejected']
const producerSubmittableStatuses: BicycleStatus[] = ['draft', 'rejected']
const adminOperationalStatuses: BicycleStatus[] = [
  'available',
  'hidden',
  'maintenance',
  'reserved',
]

export class BicycleService {
  constructor(private readonly db: DbClient) {}

  async listPublicBicycles(query: PublicBicyclesQuery) {
    const where = publicBicyclesWhere(query)
    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.db.$transaction([
      this.db.bicycle.findMany({
        where,
        include: { manufacturerProfile: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.db.bicycle.count({ where }),
    ])

    return {
      items: items.map(toPublicBicycleDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async getPublicBicycle(id: string) {
    const bicycle = await this.db.bicycle.findFirst({
      where: publicBicycleWhere(id),
      include: { manufacturerProfile: true },
    })

    if (!bicycle) {
      throw new AppError(404, 'NOT_FOUND', 'Bicycle not found')
    }

    return {
      bicycle: toPublicBicycleDto(bicycle),
    }
  }

  async listManufacturerBicycles(user: AuthenticatedUser, query: ManufacturerBicyclesQuery) {
    const profile = await this.db.manufacturerProfile.findUnique({
      where: { userId: user.id },
    })

    if (!profile) {
      return {
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
      }
    }

    const where = {
      manufacturerProfileId: profile.id,
      ...(query.status ? { status: query.status } : {}),
    }
    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.db.$transaction([
      this.db.bicycle.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.db.bicycle.count({ where }),
    ])

    return {
      items: items.map(toBicycleDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async createManufacturerBicycle(user: AuthenticatedUser, input: BicycleUpsertRequest) {
    const bicycle = await this.db.$transaction(async (tx) => {
      const [profile] = await tx.$queryRaw<Array<Pick<ManufacturerProfileRecord, 'id' | 'status'>>>`
        SELECT "id", "status"
        FROM "manufacturer_profiles"
        WHERE "userId" = ${user.id}
        FOR UPDATE
      `

      if (!profile) {
        throw new AppError(409, 'CONFLICT', 'Approved manufacturer profile is required')
      }

      if (profile.status !== 'approved') {
        throw new AppError(409, 'CONFLICT', 'Manufacturer profile must be approved to manage bicycles')
      }

      return tx.bicycle.create({
        data: {
          ...input,
          manufacturerProfileId: profile.id,
          status: 'draft',
        },
      })
    })

    return {
      bicycle: toBicycleDto(bicycle),
    }
  }

  async updateManufacturerBicycle(
    user: AuthenticatedUser,
    id: string,
    input: BicycleUpsertRequest,
  ) {
    const profile = await this.requireApprovedManufacturerProfile(user)
    const bicycle = await this.db.bicycle.findFirst({
      where: { id, manufacturerProfileId: profile.id },
    })

    if (!bicycle) {
      throw new AppError(404, 'NOT_FOUND', 'Bicycle not found')
    }

    const result = await this.db.bicycle.updateMany({
      where: {
        id: bicycle.id,
        manufacturerProfileId: profile.id,
        manufacturerProfile: { is: { status: 'approved' } },
        status: { in: producerEditableStatuses },
      },
      data: {
        ...input,
        status: 'draft',
        moderationComment: null,
        submittedAt: null,
        reviewedAt: null,
      },
    })

    if (result.count === 0) {
      throw new AppError(409, 'CONFLICT', 'Bicycle state does not allow manufacturer changes')
    }

    const updated = await this.db.bicycle.findUniqueOrThrow({
      where: { id: bicycle.id },
    })

    return {
      bicycle: toBicycleDto(updated),
    }
  }

  async submitManufacturerBicycle(user: AuthenticatedUser, id: string) {
    const profile = await this.requireApprovedManufacturerProfile(user)
    const bicycle = await this.db.bicycle.findFirst({
      where: { id, manufacturerProfileId: profile.id },
    })

    if (!bicycle) {
      throw new AppError(404, 'NOT_FOUND', 'Bicycle not found')
    }

    const result = await this.db.bicycle.updateMany({
      where: {
        id: bicycle.id,
        manufacturerProfile: { is: { status: 'approved' } },
        status: { in: producerSubmittableStatuses },
      },
      data: {
        status: 'moderation',
        moderationComment: null,
        submittedAt: new Date(),
        reviewedAt: null,
      },
    })

    if (result.count === 0) {
      throw new AppError(
        409,
        'CONFLICT',
        bicycleSubmissionConflictMessage(bicycle.status),
      )
    }

    const submitted = await this.db.bicycle.findUniqueOrThrow({
      where: { id: bicycle.id },
    })

    return {
      bicycle: toBicycleDto(submitted),
    }
  }

  async listAdminBicycles(query: AdminBicyclesQuery) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.size ? { size: query.size } : {}),
    }
    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.db.$transaction([
      this.db.bicycle.findMany({
        where,
        include: { manufacturerProfile: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.db.bicycle.count({ where }),
    ])

    return {
      items: items.map(toAdminBicycleDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async moderateAdminBicycle(id: string, input: AdminBicycleModerationPayload) {
    const bicycle = await this.db.bicycle.findUnique({
      where: { id },
      include: { manufacturerProfile: true },
    })

    if (!bicycle) {
      throw new AppError(404, 'NOT_FOUND', 'Bicycle not found')
    }

    const nextStatus: BicycleStatus = input.decision === 'approved' ? 'available' : 'rejected'
    if (nextStatus === 'available' && bicycle.manufacturerProfile.status !== 'approved') {
      throw new AppError(409, 'CONFLICT', 'Approved manufacturer profile is required')
    }

    const result = await this.db.bicycle.updateMany({
      where: {
        id,
        ...(nextStatus === 'available' ? approvedManufacturerProfileWhere() : {}),
        status: 'moderation',
      },
      data: {
        status: nextStatus,
        moderationComment: input.decision === 'approved' ? null : input.moderationComment,
        reviewedAt: new Date(),
      },
    })

    if (result.count === 0) {
      throw new AppError(409, 'CONFLICT', 'Only bicycles waiting for moderation can be reviewed')
    }

    return {
      bicycle: toAdminBicycleDto(await this.adminBicycleOrThrow(id)),
    }
  }

  async updateAdminBicycleStatus(id: string, input: AdminBicycleStatusUpdateRequest) {
    const bicycle = await this.db.bicycle.findUnique({
      where: { id },
      include: { manufacturerProfile: true },
    })

    if (!bicycle) {
      throw new AppError(404, 'NOT_FOUND', 'Bicycle not found')
    }

    if (bicycle.status === 'archived') {
      throw new AppError(409, 'CONFLICT', 'Archived bicycle cannot change status')
    }

    if (input.status === 'available' && bicycle.manufacturerProfile.status !== 'approved') {
      throw new AppError(409, 'CONFLICT', 'Approved manufacturer profile is required')
    }

    const result = await this.db.bicycle.updateMany({
      where: {
        id,
        ...(input.status === 'available' ? approvedManufacturerProfileWhere() : {}),
        status: { in: adminCurrentStatusesFor(input.status) },
      },
      data: {
        status: input.status,
      },
    })

    if (result.count === 0) {
      throw new AppError(409, 'CONFLICT', 'Bicycle state does not allow this status change')
    }

    return {
      bicycle: toAdminBicycleDto(await this.adminBicycleOrThrow(id)),
    }
  }

  private async requireApprovedManufacturerProfile(user: AuthenticatedUser) {
    const profile = await this.db.manufacturerProfile.findUnique({
      where: { userId: user.id },
    })

    if (!profile) {
      throw new AppError(409, 'CONFLICT', 'Approved manufacturer profile is required')
    }

    if (profile.status !== 'approved') {
      throw new AppError(409, 'CONFLICT', 'Manufacturer profile must be approved to manage bicycles')
    }

    return profile
  }

  private async adminBicycleOrThrow(id: string) {
    return this.db.bicycle.findUniqueOrThrow({
      where: { id },
      include: { manufacturerProfile: true },
    })
  }
}

function publicBicyclesWhere(query: PublicBicyclesQuery): Prisma.BicycleWhereInput {
  return {
    status: 'available' as const,
    ...approvedManufacturerProfileWhere(),
    ...(query.sizes ? { size: { in: query.sizes } } : {}),
    ...(query.city ? { city: { equals: query.city, mode: 'insensitive' as const } } : {}),
    ...availableForRentalPeriodWhere(query),
    ...priceWhere(query),
  }
}

function publicBicycleWhere(id: string): Prisma.BicycleWhereInput {
  return {
    id,
    status: 'available' as const,
    ...approvedManufacturerProfileWhere(),
  }
}

function approvedManufacturerProfileWhere(): Prisma.BicycleWhereInput {
  return {
    manufacturerProfile: { is: { status: 'approved' as const } },
  }
}

function priceWhere(query: PublicBicyclesQuery): Prisma.BicycleWhereInput {
  if (query.minPriceKopecks === undefined && query.maxPriceKopecks === undefined) {
    return {}
  }

  return {
    pricePerDayKopecks: {
      ...(query.minPriceKopecks === undefined ? {} : { gte: query.minPriceKopecks }),
      ...(query.maxPriceKopecks === undefined ? {} : { lte: query.maxPriceKopecks }),
    },
  }
}

function availableForRentalPeriodWhere(query: PublicBicyclesQuery): Prisma.BicycleWhereInput {
  if (!query.startsOn || !query.endsOn) {
    return {}
  }

  return {
    orderItems: {
      none: {
        order: {
          status: { in: ['confirmed', 'issued'] },
          startsOn: { lte: query.endsOn },
          endsOn: { gte: query.startsOn },
        },
      },
    },
  }
}

function adminCurrentStatusesFor(nextStatus: BicycleStatus): BicycleStatus[] {
  if (nextStatus === 'available') {
    return ['hidden', 'maintenance']
  }

  return adminOperationalStatuses
}

function bicycleSubmissionConflictMessage(status: BicycleStatus) {
  if (status === 'moderation') return 'Bicycle is already waiting for moderation'
  if (status === 'available') return 'Available bicycle must be edited before resubmission'
  if (status === 'archived') return 'Archived bicycle cannot be submitted'
  return 'Bicycle cannot be submitted from its current status'
}

function toBicycleDto(bicycle: BicycleRecord): BicycleDto {
  return {
    id: bicycle.id,
    manufacturerProfileId: bicycle.manufacturerProfileId,
    title: bicycle.title,
    description: bicycle.description,
    size: bicycle.size,
    photoUrls: bicycle.photoUrls,
    pricePerDayKopecks: bicycle.pricePerDayKopecks,
    depositKopecks: bicycle.depositKopecks,
    status: bicycle.status,
    moderationComment: bicycle.moderationComment,
    submittedAt: bicycle.submittedAt?.toISOString() ?? null,
    reviewedAt: bicycle.reviewedAt?.toISOString() ?? null,
    region: bicycle.region,
    city: bicycle.city,
    pickupAddress: bicycle.pickupAddress,
    deliveryAvailable: bicycle.deliveryAvailable,
    maxLoadKg: bicycle.maxLoadKg,
    seatHeightCm: bicycle.seatHeightCm,
    frameLengthCm: bicycle.frameLengthCm,
    wheelDiameterCm: bicycle.wheelDiameterCm,
    recommendedAnimalDimensions: bicycle.recommendedAnimalDimensions,
    safetyNotes: bicycle.safetyNotes,
    createdAt: bicycle.createdAt.toISOString(),
    updatedAt: bicycle.updatedAt.toISOString(),
  }
}

function toPublicBicycleDto(bicycle: BicycleWithManufacturerRecord) {
  const {
    manufacturerProfileId: _manufacturerProfileId,
    moderationComment: _moderationComment,
    submittedAt: _submittedAt,
    reviewedAt: _reviewedAt,
    ...publicBicycle
  } = toBicycleDto(bicycle)

  return {
    ...publicBicycle,
    status: 'available' as const,
    manufacturer: toManufacturerSummary(bicycle.manufacturerProfile),
  }
}

function toAdminBicycleDto(bicycle: BicycleWithManufacturerRecord) {
  return {
    ...toBicycleDto(bicycle),
    manufacturer: toAdminManufacturerSummary(bicycle.manufacturerProfile),
  }
}

function toManufacturerSummary(profile: ManufacturerProfileRecord) {
  return {
    id: profile.id,
    publicName: profile.publicName,
    region: profile.region,
    city: profile.city,
  }
}

function toAdminManufacturerSummary(profile: ManufacturerProfileRecord) {
  return {
    ...toManufacturerSummary(profile),
    status: profile.status,
  }
}
