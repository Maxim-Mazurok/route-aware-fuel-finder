import type {
  Coordinate,
  RoutePlan,
  Station,
  StationRouteMetrics,
} from '../domain/types'
import type { AppServices, ResolvedPlace } from './types'
import { decodePolyline } from './polyline'
import { pickRouteCandidates } from './routeCandidates'

const ROUTES_API_BASE = 'https://routes.googleapis.com'

export interface GoogleServicesConfig {
  googleApiKey: string
  fuelProxyUrl: string
}

interface ComputeRoutesResponse {
  routes: Array<{
    distanceMeters: number
    duration: string
    polyline: {
      encodedPolyline: string
    }
  }>
}

interface RouteMatrixElement {
  originIndex: number
  destinationIndex: number
  distanceMeters?: number
  duration?: string
  condition: string
}

interface GeocodingResponse {
  results: Array<{
    formatted_address: string
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
  }>
  status: string
}

function parseDurationSeconds(duration: string): number {
  return parseFloat(duration.replace('s', ''))
}

function coordinateToWaypoint(coordinate: Coordinate) {
  return {
    location: {
      latLng: {
        latitude: coordinate.lat,
        longitude: coordinate.lng,
      },
    },
  }
}

function coordinateToMatrixEntry(coordinate: Coordinate) {
  return {
    waypoint: coordinateToWaypoint(coordinate),
  }
}

export function createGoogleServices(config: GoogleServicesConfig): AppServices {
  async function fetchRoutesApi<T>(
    endpoint: string,
    body: unknown,
    fieldMask: string,
  ): Promise<T> {
    const response = await fetch(`${ROUTES_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.googleApiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        error?: { message?: string }
      } | null
      throw new Error(
        errorBody?.error?.message
          ? `Google Routes API: ${errorBody.error.message}`
          : `Google Routes API request failed with status ${response.status}`,
      )
    }

    return (await response.json()) as T
  }

  return {
    fuelPriceProvider: {
      async listStations() {
        const response = await fetch(config.fuelProxyUrl)

        if (!response.ok) {
          throw new Error(`Fuel proxy request failed with status ${response.status}`)
        }

        const payload = (await response.json()) as { stations: Station[] }
        return payload.stations
      },
    },

    geocodingProvider: {
      async resolve(query: string): Promise<ResolvedPlace | null> {
        const trimmed = query.trim()

        if (!trimmed) {
          return null
        }

        const geocodeUrl = new URL(`${config.fuelProxyUrl}/geocode`)
        geocodeUrl.searchParams.set('address', trimmed)

        const response = await fetch(geocodeUrl)

        if (!response.ok) {
          throw new Error(`Geocoding request failed with status ${response.status}`)
        }

        const payload = (await response.json()) as GeocodingResponse

        if (payload.status !== 'OK' || payload.results.length === 0) {
          return null
        }

        const result = payload.results[0]!

        return {
          label: result.formatted_address,
          coordinate: {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
          },
          source: 'google-geocoding',
        }
      },
    },

    routeProvider: {
      async planRoute(
        origin: Coordinate,
        destination: Coordinate,
      ): Promise<RoutePlan> {
        const payload = await fetchRoutesApi<ComputeRoutesResponse>(
          '/directions/v2:computeRoutes',
          {
            origin: coordinateToWaypoint(origin),
            destination: coordinateToWaypoint(destination),
            travelMode: 'DRIVE',
          },
          'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
        )

        const route = payload.routes[0]

        if (!route) {
          throw new Error('Google Routes API did not return a route')
        }

        const path = decodePolyline(route.polyline.encodedPolyline)
        const durationSeconds = parseDurationSeconds(route.duration)

        return {
          origin,
          destination,
          path,
          distanceKm: route.distanceMeters / 1_000,
          durationMinutes: durationSeconds / 60,
        }
      },

      async measureStationDetours(
        route: RoutePlan,
        stations: Station[],
      ): Promise<Record<string, StationRouteMetrics>> {
        const candidates = pickRouteCandidates(route, stations)

        if (candidates.length === 0) {
          return {}
        }

        const candidateCoordinates = candidates.map(
          ({ station }) => station.coordinate,
        )

        // Call 1: origin → [destination, station1, ..., stationN]
        const originToAllElements = await fetchRoutesApi<RouteMatrixElement[]>(
          '/distanceMatrix/v2:computeRouteMatrix',
          {
            origins: [coordinateToMatrixEntry(route.origin)],
            destinations: [
              coordinateToMatrixEntry(route.destination),
              ...candidateCoordinates.map(coordinateToMatrixEntry),
            ],
            travelMode: 'DRIVE',
          },
          'originIndex,destinationIndex,distanceMeters,duration,condition',
        )

        // Call 2: [station1, ..., stationN] → destination
        const allToDestinationElements = await fetchRoutesApi<RouteMatrixElement[]>(
          '/distanceMatrix/v2:computeRouteMatrix',
          {
            origins: candidateCoordinates.map(coordinateToMatrixEntry),
            destinations: [coordinateToMatrixEntry(route.destination)],
            travelMode: 'DRIVE',
          },
          'originIndex,destinationIndex,distanceMeters,duration,condition',
        )

        // Base distance: origin → destination (destinationIndex 0 in call 1)
        const baseElement = originToAllElements.find(
          (element) =>
            element.originIndex === 0 && element.destinationIndex === 0,
        )
        const baseDistanceMeters =
          baseElement?.distanceMeters ?? route.distanceKm * 1_000
        const baseDurationSeconds = baseElement?.duration
          ? parseDurationSeconds(baseElement.duration)
          : route.durationMinutes * 60

        // Lookup: origin → each station (destinationIndex 1..N in call 1)
        const originToStationByIndex = new Map<
          number,
          { distanceMeters: number; durationSeconds: number }
        >()
        for (const element of originToAllElements) {
          if (
            element.destinationIndex > 0 &&
            element.condition === 'ROUTE_EXISTS' &&
            element.distanceMeters != null &&
            element.duration
          ) {
            originToStationByIndex.set(element.destinationIndex - 1, {
              distanceMeters: element.distanceMeters,
              durationSeconds: parseDurationSeconds(element.duration),
            })
          }
        }

        // Lookup: each station → destination (originIndex 0..N-1 in call 2)
        const stationToDestinationByIndex = new Map<
          number,
          { distanceMeters: number; durationSeconds: number }
        >()
        for (const element of allToDestinationElements) {
          if (
            element.condition === 'ROUTE_EXISTS' &&
            element.distanceMeters != null &&
            element.duration
          ) {
            stationToDestinationByIndex.set(element.originIndex, {
              distanceMeters: element.distanceMeters,
              durationSeconds: parseDurationSeconds(element.duration),
            })
          }
        }

        return Object.fromEntries(
          candidates.map(({ metrics }, index) => {
            const toStation = originToStationByIndex.get(index)
            const stationToDestination =
              stationToDestinationByIndex.get(index)

            if (!toStation || !stationToDestination) {
              return [
                metrics.stationId,
                {
                  ...metrics,
                  extraDistanceKm: Number.POSITIVE_INFINITY,
                  extraDurationMinutes: Number.POSITIVE_INFINITY,
                },
              ]
            }

            return [
              metrics.stationId,
              {
                ...metrics,
                extraDistanceKm:
                  (toStation.distanceMeters +
                    stationToDestination.distanceMeters -
                    baseDistanceMeters) /
                  1_000,
                extraDurationMinutes:
                  (toStation.durationSeconds +
                    stationToDestination.durationSeconds -
                    baseDurationSeconds) /
                  60,
              },
            ]
          }),
        )
      },
    },

    currentLocationProvider: {
      async getCurrentLocation(): Promise<ResolvedPlace> {
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
              timeout: 6_000,
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
