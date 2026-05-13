import {
  type ManufacturerProfileDto,
  type ManufacturerProfileStatus,
  type ManufacturerProfileUpsertRequest,
} from '@web-app-demo/contracts'

export const manufacturerStatuses: ManufacturerProfileStatus[] = [
  'draft',
  'moderation',
  'approved',
  'rejected',
  'blocked',
]

export type AdminManufacturerStatusFilter = ManufacturerProfileStatus | 'all'

export function manufacturerStatusLabel(status: ManufacturerProfileStatus | 'all') {
  switch (status) {
    case 'all':
      return 'Все статусы'
    case 'approved':
      return 'Одобрен'
    case 'blocked':
      return 'Заблокирован'
    case 'draft':
      return 'Черновик'
    case 'moderation':
      return 'На модерации'
    case 'rejected':
      return 'Отклонен'
  }
}

export function manufacturerProfileQueryKey(userId: string | null | undefined) {
  return ['manufacturer', 'profile', userId ?? null] as const
}

export const emptyManufacturerProfile: ManufacturerProfileUpsertRequest = {
  legalName: '',
  publicName: '',
  region: null,
  city: '',
  phone: '',
  email: '',
  description: '',
}

export function manufacturerProfileToForm(
  profile: ManufacturerProfileDto,
): ManufacturerProfileUpsertRequest {
  return {
    legalName: profile.legalName,
    publicName: profile.publicName,
    region: profile.region,
    city: profile.city,
    phone: profile.phone,
    email: profile.email,
    description: profile.description,
  }
}
