export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatFuelPrice(value: number) {
  return `${value.toFixed(1)} c/L`
}

export function formatFuelCode(value: string) {
  switch (value) {
    case 'P95':
      return '95'
    case 'P98':
      return '98'
    default:
      return value
  }
}

export function formatDistance(value: number) {
  return `${value.toFixed(1)} km`
}

export function formatDurationMinutes(value: number) {
  if (value < 1) {
    return '<1 min'
  }

  return `${Math.round(value)} min`
}

export function formatAgeHours(ageHours: number) {
  if (ageHours < 24) {
    return `${Math.round(ageHours)}h ago`
  }

  return `${Math.round(ageHours / 24)}d ago`
}
