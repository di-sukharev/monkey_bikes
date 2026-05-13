export function futureDateOnly(daysFromToday: number) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + daysFromToday)

  return date.toISOString().slice(0, 10)
}
