import type {
  AdminBicycleStatusUpdateRequest,
  BicycleDto,
  BicycleSize,
  BicycleStatus,
  BicycleUpsertInput,
  ManufacturerProfileStatus,
} from '@web-app-demo/contracts'

export const bicycleSizes: BicycleSize[] = ['S', 'M', 'L']

export const bicycleStatuses: BicycleStatus[] = [
  'draft',
  'moderation',
  'available',
  'rejected',
  'reserved',
  'rented',
  'maintenance',
  'hidden',
  'archived',
]

export type BicycleFormValues = BicycleUpsertInput
export type AdminBicycleStatusTarget = AdminBicycleStatusUpdateRequest['status']

const producerEditableStatuses: BicycleStatus[] = ['available', 'draft', 'moderation', 'rejected']
const producerSubmittableStatuses: BicycleStatus[] = ['draft', 'rejected']
const adminOperationalSourceStatuses: BicycleStatus[] = [
  'available',
  'hidden',
  'maintenance',
  'reserved',
]

export const adminBicycleStatusTargets: AdminBicycleStatusTarget[] = [
  'available',
  'hidden',
  'maintenance',
  'archived',
]

export const emptyBicycleForm: BicycleFormValues = {
  title: '',
  description: '',
  size: 'S',
  photoUrls: [],
  pricePerDayKopecks: 1000,
  depositKopecks: 0,
  region: null,
  city: '',
  pickupAddress: '',
  deliveryAvailable: false,
  maxLoadKg: 1,
  seatHeightCm: 1,
  frameLengthCm: 1,
  wheelDiameterCm: 1,
  recommendedAnimalDimensions: '',
  safetyNotes: '',
}

export function bicycleToForm(bicycle: BicycleDto): BicycleFormValues {
  return {
    title: bicycle.title,
    description: bicycle.description,
    size: bicycle.size,
    photoUrls: bicycle.photoUrls,
    pricePerDayKopecks: bicycle.pricePerDayKopecks,
    depositKopecks: bicycle.depositKopecks,
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
  }
}

export function formatMoney(kopecks: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(kopecks / 100)
}

export function bicycleStatusLabel(status: BicycleStatus | 'all') {
  switch (status) {
    case 'all':
      return 'Все статусы'
    case 'archived':
      return 'Архив'
    case 'available':
      return 'Доступен'
    case 'draft':
      return 'Черновик'
    case 'hidden':
      return 'Скрыт'
    case 'maintenance':
      return 'На обслуживании'
    case 'moderation':
      return 'На модерации'
    case 'rejected':
      return 'Отклонен'
    case 'rented':
      return 'Выдан'
    case 'reserved':
      return 'Зарезервирован'
  }
}

export function canManufacturerEditBicycle(status: BicycleStatus) {
  return producerEditableStatuses.includes(status)
}

export function canManufacturerSubmitBicycle(status: BicycleStatus) {
  return producerSubmittableStatuses.includes(status)
}

export function canAdminApproveBicycle(
  status: BicycleStatus,
  manufacturerStatus: ManufacturerProfileStatus,
) {
  return status === 'moderation' && manufacturerStatus === 'approved'
}

export function adminBicycleStatusOptionsFor(
  status: BicycleStatus,
  manufacturerStatus: ManufacturerProfileStatus,
): AdminBicycleStatusTarget[] {
  if (status === 'hidden' || status === 'maintenance') {
    return adminBicycleStatusTargets.filter(
      (nextStatus) =>
        nextStatus !== status &&
        (nextStatus !== 'available' || manufacturerStatus === 'approved'),
    )
  }

  if (adminOperationalSourceStatuses.includes(status)) {
    return adminBicycleStatusTargets.filter((nextStatus) => nextStatus !== 'available')
  }

  return []
}

export function manufacturerBicyclesQueryKey(userId: string | null | undefined, page: number) {
  return [...manufacturerBicyclesRootQueryKey(userId), page] as const
}

export function manufacturerBicyclesRootQueryKey(userId: string | null | undefined) {
  return ['manufacturer', 'bicycles', userId ?? null] as const
}

export function adminBicyclesQueryKey(page: number, status: BicycleStatus | 'all') {
  return ['admin', 'bicycles', page, status] as const
}

export function parseAdminBicycleStatusFilter(value: unknown): BicycleStatus | 'all' {
  if (value === 'all') return 'all'
  return bicycleStatuses.includes(value as BicycleStatus) ? value as BicycleStatus : 'moderation'
}
