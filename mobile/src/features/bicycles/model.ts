import type { BicycleSize } from '@web-app-demo/contracts';

export const bicycleSizes: BicycleSize[] = ['S', 'M', 'L'];

export function formatMoney(kopecks: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(kopecks / 100);
}

export function toggleSelection(current: string[], id: string) {
  return current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id];
}

export function parseBicycleIds(value: unknown) {
  if (Array.isArray(value)) {
    return uniqueIds(value.flatMap((item) => String(item).split(',')));
  }

  if (typeof value === 'string') {
    return uniqueIds(value.split(','));
  }

  return [];
}

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
