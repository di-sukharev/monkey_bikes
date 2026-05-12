import { z } from 'zod'

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/
const millisecondsPerDay = 86_400_000

export const dateOnlyStringSchema = z.string()
  .regex(dateOnlyPattern, 'Expected YYYY-MM-DD')
  .refine(isValidDateOnly, 'Expected a valid calendar date')

export function isValidDateOnly(value: string) {
  try {
    dateOnlyToEpochDay(value)
    return true
  } catch {
    return false
  }
}

export function dateOnlyToEpochDay(value: string) {
  const match = dateOnlyPattern.exec(value)
  if (!match) {
    throw new Error('Expected YYYY-MM-DD')
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  ) {
    return Math.floor(date.getTime() / millisecondsPerDay)
  }

  throw new Error('Expected a valid calendar date')
}

export function rentalDaysInclusive(startsOn: string, endsOn: string) {
  const startDay = dateOnlyToEpochDay(startsOn)
  const endDay = dateOnlyToEpochDay(endsOn)

  if (startDay > endDay) {
    throw new Error('Start date must be before or equal to end date')
  }

  return endDay - startDay + 1
}
