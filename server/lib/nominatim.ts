import type { Coordinate } from '../../src/domain/types'
import type { ResolvedPlaceDto } from '../types'

type NominatimEndpoint = {
  baseUrl: string
}

export class NominatimClient {
  constructor(
    private readonly endpoints: NominatimEndpoint[],
    private readonly userAgent: string,
  ) {}

  async resolve(query: string): Promise<ResolvedPlaceDto | null> {
    let lastError: Error | null = null

    for (const endpoint of this.endpoints) {
      try {
        const url = new URL('/search', endpoint.baseUrl)
        url.searchParams.set('q', query)
        url.searchParams.set('format', 'jsonv2')
        url.searchParams.set('limit', '1')
        url.searchParams.set('countrycodes', 'au')
        url.searchParams.set('addressdetails', '0')

        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
          },
        })

        if (!response.ok) {
          throw new Error(
            `Nominatim returned status ${response.status} from ${endpoint.baseUrl}`,
          )
        }

        const results = (await response.json()) as Array<{
          display_name: string
          lat: string
          lon: string
        }>

        if (results.length === 0) {
          continue
        }

        return {
          label: results[0].display_name,
          coordinate: {
            lat: Number(results[0].lat),
            lng: Number(results[0].lon),
          },
          source: 'nominatim',
        }
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error('Geocoding request failed')
      }
    }

    if (lastError) {
      throw lastError
    }

    return null
  }

  async healthcheck() {
    for (const endpoint of this.endpoints) {
      try {
        const probe = new URL('/status.php', endpoint.baseUrl)
        probe.searchParams.set('format', 'json')
        const response = await fetch(probe, {
          headers: {
            'User-Agent': this.userAgent,
          },
        })

        if (response.ok) {
          return true
        }
      } catch {
        continue
      }
    }

    return false
  }
}

export function formatCoordinate(coordinate: Coordinate) {
  return `${coordinate.lng},${coordinate.lat}`
}
