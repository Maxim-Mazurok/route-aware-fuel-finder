import { describe, expect, it } from 'vitest'

import { chooseBestOffer, computeFillLitres, estimatedRangeKm } from './fuel'
import type { Station, VehicleProfile } from './types'

const vehicle: VehicleProfile = {
  tankCapacityLitres: 50,
  currentFuelLitres: 15,
  consumptionLitresPer100Km: 8,
  allowedFuelCodes: ['U91', 'P95', 'P98'],
}

const station: Station = {
  id: 'station-1',
  brand: 'Budget',
  name: 'Budget Annandale',
  address: '123 Booth Street, Annandale NSW',
  coordinate: { lat: -33.88, lng: 151.17 },
  fuelOffers: [
    { fuelCode: 'P98', priceCentsPerLitre: 221.9, updatedAt: '2026-03-09T10:00:00.000Z' },
    { fuelCode: 'U91', priceCentsPerLitre: 204.9, updatedAt: '2026-03-09T10:00:00.000Z' },
  ],
}

describe('fuel calculations', () => {
  it('fills the remaining tank by default', () => {
    expect(computeFillLitres({ kind: 'full' }, vehicle, 204.9)).toBe(35)
  })

  it('supports percentage targets', () => {
    expect(
      computeFillLitres({ kind: 'percentage', targetPercent: 60 }, vehicle, 204.9),
    ).toBe(15)
  })

  it('caps budget fills at remaining tank capacity', () => {
    expect(computeFillLitres({ kind: 'budget', amountDollars: 200 }, vehicle, 200)).toBe(
      35,
    )
  })

  it('chooses the cheapest allowed fuel at a station', () => {
    expect(chooseBestOffer(station, ['U91', 'P98'])?.fuelCode).toBe('U91')
  })

  it('estimates reach using current fuel and consumption', () => {
    expect(estimatedRangeKm(vehicle)).toBeCloseTo(187.5, 1)
  })

  it('treats zero consumption as effectively unlimited range instead of crashing', () => {
    expect(
      estimatedRangeKm({
        ...vehicle,
        consumptionLitresPer100Km: 0,
      }),
    ).toBe(Number.POSITIVE_INFINITY)
  })
})
