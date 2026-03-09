import type { Coordinate, RoutePlan } from '../../src/domain/types'
import { pathDistanceKm } from '../../src/domain/geo'
import { formatCoordinate } from './nominatim'

export class OsrmClient {
  constructor(private readonly baseUrl: string) {}

  async planRoute(origin: Coordinate, destination: Coordinate): Promise<RoutePlan> {
    const coordinates = `${formatCoordinate(origin)};${formatCoordinate(destination)}`
    const url = new URL(`/route/v1/driving/${coordinates}`, this.baseUrl)
    url.searchParams.set('overview', 'full')
    url.searchParams.set('geometries', 'geojson')

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`OSRM route lookup failed with status ${response.status}`)
    }

    const payload = (await response.json()) as {
      routes?: Array<{
        distance: number
        duration: number
        geometry: {
          coordinates: number[][]
        }
      }>
    }
    const route = payload.routes?.[0]

    if (!route) {
      throw new Error('OSRM did not return a route')
    }

    const path = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))

    return {
      origin,
      destination,
      path,
      distanceKm: route.distance / 1000 || pathDistanceKm(path),
      durationMinutes: route.duration / 60,
    }
  }

  async measureDetours(origin: Coordinate, destination: Coordinate, candidates: Array<{ stationId: string; coordinate: Coordinate }>) {
    const coordinateList = [origin, destination, ...candidates.map((candidate) => candidate.coordinate)]
      .map(formatCoordinate)
      .join(';')
    const url = new URL(`/table/v1/driving/${coordinateList}`, this.baseUrl)
    url.searchParams.set('annotations', 'distance,duration')

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`OSRM table lookup failed with status ${response.status}`)
    }

    const payload = (await response.json()) as {
      distances?: Array<Array<number | null>>
      durations?: Array<Array<number | null>>
    }

    const baseDistance = payload.distances?.[0]?.[1]
    const baseDuration = payload.durations?.[0]?.[1]

    if (baseDistance == null || baseDuration == null) {
      throw new Error('OSRM table response was incomplete')
    }

    return Object.fromEntries(
      candidates.map((candidate, index) => {
        const coordinateIndex = index + 2
        const toStationDistance = payload.distances?.[0]?.[coordinateIndex]
        const stationToDestinationDistance = payload.distances?.[coordinateIndex]?.[1]
        const toStationDuration = payload.durations?.[0]?.[coordinateIndex]
        const stationToDestinationDuration = payload.durations?.[coordinateIndex]?.[1]

        if (
          toStationDistance == null ||
          stationToDestinationDistance == null ||
          toStationDuration == null ||
          stationToDestinationDuration == null
        ) {
          return [
            candidate.stationId,
            {
              extraDistanceKm: Number.POSITIVE_INFINITY,
              extraDurationMinutes: Number.POSITIVE_INFINITY,
            },
          ]
        }

        return [
          candidate.stationId,
          {
            extraDistanceKm:
              (toStationDistance + stationToDestinationDistance - baseDistance) / 1000,
            extraDurationMinutes:
              (toStationDuration + stationToDestinationDuration - baseDuration) / 60,
          },
        ]
      }),
    )
  }

  async healthcheck() {
    const response = await fetch(new URL('/nearest/v1/driving/151.2065,-33.8731', this.baseUrl))
    return response.ok
  }
}
