import { interpolateRoutePath, nearestPointOnPath, pathDistanceKm } from '../domain/geo'
import { createMockStations, KNOWN_PLACES } from '../fixtures/mockData'
import type { AppServices, CurrentLocationProvider, ResolvedPlace, RouteProvider } from './types'

function normalize(text: string) {
  return text.trim().toLowerCase()
}

function averageSpeedKmPerHour(distanceKm: number) {
  if (distanceKm < 8) {
    return 24
  }

  if (distanceKm < 18) {
    return 31
  }

  return 42
}

function createMockGeocodingProvider() {
  return {
    async resolve(query: string) {
      const normalizedQuery = normalize(query)

      if (!normalizedQuery) {
        return null
      }

      const exact = KNOWN_PLACES.find((place) =>
        normalize(place.label).includes(normalizedQuery),
      )

      if (exact) {
        return {
          label: exact.label,
          coordinate: exact.coordinate,
          source: 'mock-geocoder' as const,
        }
      }

      const aliasMatch = KNOWN_PLACES.find((place) =>
        place.aliases.some((alias) => normalizedQuery.includes(alias)),
      )

      if (!aliasMatch) {
        return null
      }

      return {
        label: aliasMatch.label,
        coordinate: aliasMatch.coordinate,
        source: 'mock-geocoder' as const,
      }
    },
  }
}

function createMockRouteProvider(): RouteProvider {
  return {
    async planRoute(origin, destination) {
      const path = interpolateRoutePath(origin, destination)
      const distanceKm = pathDistanceKm(path) * 1.08
      const durationMinutes = (distanceKm / averageSpeedKmPerHour(distanceKm)) * 60
      return {
        origin,
        destination,
        path,
        distanceKm,
        durationMinutes,
      }
    },
    async measureStationDetours(route, stations) {
      return Object.fromEntries(
        stations.map((station) => {
          const nearest = nearestPointOnPath(station.coordinate, route.path)
          const progress = route.distanceKm === 0 ? 0 : nearest.progressDistanceKm / route.distanceKm
          const extraDistanceKm =
            Math.max(0.7, nearest.distanceKm * 2.45 + 0.55 + progress * 0.9)
          const extraDurationMinutes = (extraDistanceKm / 30) * 60 + 0.6

          return [
            station.id,
            {
              stationId: station.id,
              routeProgress: progress,
              distanceFromOriginKm: nearest.distanceFromOriginKm + nearest.distanceKm * 0.7,
              distanceToRouteKm: nearest.distanceKm,
              extraDistanceKm,
              extraDurationMinutes,
            },
          ]
        }),
      )
    },
  }
}

export function createMockServices({
  now = () => new Date(),
  currentLocation,
}: {
  now?: () => Date
  currentLocation?: ResolvedPlace
} = {}): AppServices {
  const currentLocationProvider: CurrentLocationProvider = {
    async getCurrentLocation() {
      return (
        currentLocation ?? {
          label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
          coordinate: { lat: -33.8731, lng: 151.2065 },
          source: 'current-location',
        }
      )
    },
  }

  return {
    fuelPriceProvider: {
      async listStations() {
        return createMockStations(now())
      },
    },
    geocodingProvider: createMockGeocodingProvider(),
    routeProvider: createMockRouteProvider(),
    currentLocationProvider,
    now,
  }
}
