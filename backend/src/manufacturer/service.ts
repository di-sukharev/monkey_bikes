import type {
  AdminManufacturerStatusUpdatePayload,
  AdminManufacturersQuery,
  AdminManufacturerProfileDto,
  ManufacturerProfileDto,
  ManufacturerProfileUpsertRequest,
  UserDto,
} from '@web-app-demo/contracts'

import type { DbClient } from '../db'
import { AppError } from '../http/errors'
import type { AuthenticatedUser } from '../auth/service'
import { toUserDto } from '../auth/service'

type ManufacturerProfileRecord = {
  id: string
  userId: string
  legalName: string
  publicName: string
  region: string | null
  city: string
  phone: string
  email: string
  description: string
  status: 'approved' | 'blocked' | 'draft' | 'moderation' | 'rejected'
  moderationComment: string | null
  submittedAt: Date | null
  reviewedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type AdminManufacturerProfileRecord = ManufacturerProfileRecord & {
  user: {
    id: string
    email: string
    displayName: string | null
    role: 'admin' | 'manufacturer' | 'user'
    status: 'active' | 'blocked'
    createdAt: Date
    updatedAt: Date
  }
}

export class ManufacturerProfileService {
  constructor(private readonly db: DbClient) {}

  async getCurrentProfile(user: AuthenticatedUser) {
    const profile = await this.db.manufacturerProfile.findUnique({
      where: { userId: user.id },
    })

    return {
      profile: profile ? toManufacturerProfileDto(profile) : null,
    }
  }

  async upsertCurrentProfile(user: AuthenticatedUser, input: ManufacturerProfileUpsertRequest) {
    const profile = await this.db.$transaction(async (tx) => {
      const currentProfile = await tx.manufacturerProfile.findUnique({
        where: { userId: user.id },
      })

      if (!currentProfile) {
        return tx.manufacturerProfile.create({
          data: {
            ...input,
            userId: user.id,
            status: 'draft',
          },
        })
      }

      const result = await tx.manufacturerProfile.updateMany({
        where: {
          id: currentProfile.id,
          status: { not: 'blocked' },
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
        throw new AppError(409, 'CONFLICT', 'Blocked manufacturer profile cannot be changed')
      }

      return tx.manufacturerProfile.findUniqueOrThrow({
        where: { id: currentProfile.id },
      })
    })

    return {
      profile: toManufacturerProfileDto(profile),
    }
  }

  async submitCurrentProfile(user: AuthenticatedUser) {
    const currentProfile = await this.db.manufacturerProfile.findUnique({
      where: { userId: user.id },
    })

    if (!currentProfile) {
      throw new AppError(409, 'CONFLICT', 'Manufacturer profile is required before submission')
    }

    const result = await this.db.manufacturerProfile.updateMany({
      where: {
        id: currentProfile.id,
        status: { in: ['draft', 'rejected'] },
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
        manufacturerSubmissionConflictMessage(currentProfile.status),
      )
    }

    const profile = await this.db.manufacturerProfile.findUniqueOrThrow({
      where: { id: currentProfile.id },
    })

    return {
      profile: toManufacturerProfileDto(profile),
    }
  }

  async listAdminManufacturers(query: AdminManufacturersQuery) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
    }
    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.db.$transaction([
      this.db.manufacturerProfile.findMany({
        where,
        include: { user: true },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.db.manufacturerProfile.count({ where }),
    ])

    return {
      items: items.map(toAdminManufacturerProfileDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async updateAdminManufacturerStatus(id: string, input: AdminManufacturerStatusUpdatePayload) {
    const currentProfile = await this.db.manufacturerProfile.findUnique({
      where: { id },
    })

    if (!currentProfile) {
      throw new AppError(404, 'NOT_FOUND', 'Manufacturer profile not found')
    }

    const allowedSourceStatuses: Array<ManufacturerProfileRecord['status']> =
      input.status === 'blocked' ? ['approved', 'draft', 'moderation', 'rejected'] : ['moderation']
    const result = await this.db.manufacturerProfile.updateMany({
      where: {
        id,
        status: { in: allowedSourceStatuses },
      },
      data: {
        status: input.status,
        moderationComment: input.status === 'approved' ? null : input.moderationComment,
        reviewedAt: new Date(),
      },
    })

    if (result.count === 0) {
      throw new AppError(
        409,
        'CONFLICT',
        manufacturerModerationConflictMessage(input.status, currentProfile.status),
      )
    }

    const profile = await this.db.manufacturerProfile.findUniqueOrThrow({
      where: { id },
      include: { user: true },
    })

    return {
      profile: toAdminManufacturerProfileDto(profile),
    }
  }
}

function toManufacturerProfileDto(profile: ManufacturerProfileRecord): ManufacturerProfileDto {
  return {
    id: profile.id,
    userId: profile.userId,
    legalName: profile.legalName,
    publicName: profile.publicName,
    region: profile.region,
    city: profile.city,
    phone: profile.phone,
    email: profile.email,
    description: profile.description,
    status: profile.status,
    moderationComment: profile.moderationComment,
    submittedAt: profile.submittedAt?.toISOString() ?? null,
    reviewedAt: profile.reviewedAt?.toISOString() ?? null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}

function manufacturerSubmissionConflictMessage(status: ManufacturerProfileRecord['status']) {
  if (status === 'blocked') return 'Blocked manufacturer profile cannot be submitted'
  if (status === 'moderation') return 'Manufacturer profile is already waiting for moderation'
  if (status === 'approved') return 'Approved manufacturer profile must be edited before resubmission'
  return 'Manufacturer profile cannot be submitted from its current status'
}

function manufacturerModerationConflictMessage(
  nextStatus: AdminManufacturerStatusUpdatePayload['status'],
  currentStatus: ManufacturerProfileRecord['status'],
) {
  if (nextStatus === 'blocked' && currentStatus === 'blocked') {
    return 'Manufacturer profile is already blocked'
  }

  if (nextStatus !== 'blocked') {
    return 'Only profiles waiting for moderation can be approved or rejected'
  }

  return 'Manufacturer profile cannot be changed from its current status'
}

function toAdminManufacturerProfileDto(
  profile: AdminManufacturerProfileRecord,
): AdminManufacturerProfileDto {
  return {
    ...toManufacturerProfileDto(profile),
    user: toUserDto(profile.user) as UserDto,
  }
}
