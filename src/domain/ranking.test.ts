import { describe, expect, it } from 'vitest'

import { buildRankedStations } from './ranking'
import type {
  RankingPreferences,
  RoutePlan,
  Station,
  StationRouteMetrics,
  VehicleProfile,
} from './types'

const now = new Date('2026-03-09T10:00:00.000Z')

const stations: Station[] = [
  {
    id: 'cheap-detour',
    brand: 'Budget',
    name: 'Budget Five Dock',
    address: 'Five Dock NSW',
    coordinate: { lat: -33.87, lng: 151.12 },
    fuelOffers: [{ fuelCode: 'U91', priceCentsPerLitre: 191.9, updatedAt: '2026-03-09T08:00:00.000Z' }],
  },
  {
    id: 'balanced',
    brand: 'United',
    name: 'United Ashfield',
    address: 'Ashfield NSW',
    coordinate: { lat: -33.89, lng: 151.13 },
    fuelOffers: [{ fuelCode: 'U91', priceCentsPerLitre: 198.9, updatedAt: '2026-03-09T07:30:00.000Z' }],
  },
]

const route: RoutePlan = {
  origin: { lat: -33.87, lng: 151.2 },
  destination: { lat: -33.81, lng: 151.0 },
  path: [
    { lat: -33.87, lng: 151.2 },
    { lat: -33.84, lng: 151.1 },
    { lat: -33.81, lng: 151.0 },
  ],
  distanceKm: 24,
  durationMinutes: 36,
}

const metricsByStationId: Record<string, StationRouteMetrics> = {
  'cheap-detour': {
    stationId: 'cheap-detour',
    routeProgress: 0.45,
    distanceFromOriginKm: 11,
    distanceToRouteKm: 1.8,
    extraDistanceKm: 5.4,
    extraDurationMinutes: 9.5,
  },
  balanced: {
    stationId: 'balanced',
    routeProgress: 0.52,
    distanceFromOriginKm: 13,
    distanceToRouteKm: 0.4,
    extraDistanceKm: 1.8,
    extraDurationMinutes: 3.2,
  },
}

const vehicle: VehicleProfile = {
  tankCapacityLitres: 50,
  currentFuelLitres: 17.5,
  consumptionLitresPer100Km: 8.2,
  allowedFuelCodes: ['U91'],
}

const preferences: RankingPreferences = {
  timeValueDollarsPerHour: 32,
  maxExtraMinutes: 12,
  maxExtraKilometres: 8,
  hideUnreachable: false,
  sortMode: 'recommended',
}

describe('ranking', () => {
  it('prefers a better overall stop over the absolute cheapest pump price', () => {
    const ranked = buildRankedStations({
      now,
      stations,
      route,
      metricsByStationId,
      vehicle,
      fillStrategy: { kind: 'full' },
      preferences,
    })

    expect(ranked[0]?.station.id).toBe('balanced')
  })

  it('can hide unreachable stations', () => {
    const ranked = buildRankedStations({
      now,
      stations,
      route,
      metricsByStationId: {
        ...metricsByStationId,
        balanced: {
          ...metricsByStationId.balanced,
          distanceFromOriginKm: 200,
        },
      },
      vehicle: {
        ...vehicle,
        currentFuelLitres: 4,
      },
      fillStrategy: { kind: 'full' },
      preferences: {
        ...preferences,
        hideUnreachable: true,
      },
    })

    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.station.id).toBe('cheap-detour')
  })

  it('does not exclude stations by detour when both detour caps are disabled', () => {
    const ranked = buildRankedStations({
      now,
      stations,
      route,
      metricsByStationId,
      vehicle,
      fillStrategy: { kind: 'full' },
      preferences: {
        ...preferences,
        maxExtraMinutes: null,
        maxExtraKilometres: null,
      },
    })

    expect(ranked).toHaveLength(2)
  })
})
