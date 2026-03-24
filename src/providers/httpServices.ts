import type {
  Coordinate,
  RoutePlan,
  Station,
  StationRouteMetrics,
} from '../domain/types'
import type { AppServices, ResolvedPlace } from './types'
import { pickRouteCandidates } from './routeCandidates'

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(
      payload?.error
        ? `${payload.error} (status ${response.status})`
        : `Request failed with status ${response.status}`,
    )
  }

  return (await response.json()) as T
}

export function createHttpServices(): AppServices {
  return {
    fuelPriceProvider: {
      async listStations() {
        const payload = await requestJson<{ stations: Station[] }>('/api/fuel/stations')
        return payload.stations
      },
    },
    geocodingProvider: {
      async resolve(query: string) {
        const trimmed = query.trim()

        if (!trimmed) {
          return null
        }

        try {
          return await requestJson<ResolvedPlace>(
            `/api/geocode?query=${encodeURIComponent(trimmed)}`,
          )
        } catch (error) {
          if (error instanceof Error && error.message.includes('404')) {
            return null
          }
          throw error
        }
      },
    },
    routeProvider: {
      async planRoute(origin: Coordinate, destination: Coordinate) {
        return requestJson<RoutePlan>('/api/route/plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ origin, destination }),
        })
      },
      async measureStationDetours(route: RoutePlan, stations: Station[]) {
        const candidates = pickRouteCandidates(route, stations)
        const detourPayload = await requestJson<{
          metricsByStationId: Record<
            string,
            Pick<StationRouteMetrics, 'extraDistanceKm' | 'extraDurationMinutes'>
          >
        }>('/api/route/detours', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            origin: route.origin,
            destination: route.destination,
            candidates: candidates.map(({ station }) => ({
              stationId: station.id,
              coordinate: station.coordinate,
            })),
          }),
        })

        return Object.fromEntries(
          candidates.map(({ metrics }) => [
            metrics.stationId,
            {
              ...metrics,
              ...detourPayload.metricsByStationId[metrics.stationId],
            },
          ]),
        )
      },
    },
    currentLocationProvider: {
      async getCurrentLocation() {
        if (
          !navigator.geolocation ||
          typeof navigator.geolocation.getCurrentPosition !== 'function'
        ) {
          return {
            label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
            coordinate: { lat: -33.8731, lng: 151.2065 },
            source: 'current-location',
          }
        }

        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) =>
              resolve({
                label: 'Current location',
                coordinate: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                },
                source: 'current-location',
              }),
            () =>
              resolve({
                label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
                coordinate: { lat: -33.8731, lng: 151.2065 },
                source: 'current-location',
              }),
            {
              enableHighAccuracy: false,
              timeout: 6000,
              maximumAge: 60_000,
            },
          )
        })
      },
    },
    now() {
      return new Date()
    },
  }
}
