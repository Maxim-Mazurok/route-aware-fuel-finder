import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockStations } from '../fixtures/mockData'
import type { RoutePlan } from '../domain/types'
import { createHttpServices } from './httpServices'

const sampleRoute: RoutePlan = {
  origin: { lat: -33.8731, lng: 151.2065 },
  destination: { lat: -33.8176, lng: 151.0053 },
  path: [
    { lat: -33.8731, lng: 151.2065 },
    { lat: -33.878, lng: 151.155 },
    { lat: -33.871, lng: 151.102 },
    { lat: -33.8176, lng: 151.0053 },
  ],
  distanceKm: 24.8,
  durationMinutes: 31,
}

describe('createHttpServices', () => {
  const originalGeolocation = navigator.geolocation

  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    })
  })

  it('loads the live station dataset from the API', async () => {
    const now = new Date('2026-03-09T10:00:00.000Z')
    const stations = createMockStations(now)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stations }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const services = createHttpServices()

    await expect(services.fuelPriceProvider.listStations()).resolves.toEqual(stations)
    expect(fetchMock).toHaveBeenCalledWith('/api/fuel/stations', undefined)
  })

  it('treats blank or 404 geocode responses as no match', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'No matching place found' }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const services = createHttpServices()

    await expect(services.geocodingProvider.resolve('   ')).resolves.toBeNull()
    await expect(services.geocodingProvider.resolve('Unknown Place')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('posts route planning requests with the supplied coordinates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleRoute,
    })

    vi.stubGlobal('fetch', fetchMock)

    const services = createHttpServices()

    await expect(
      services.routeProvider.planRoute(sampleRoute.origin, sampleRoute.destination),
    ).resolves.toEqual(sampleRoute)

    expect(fetchMock).toHaveBeenCalledWith('/api/route/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: sampleRoute.origin,
        destination: sampleRoute.destination,
      }),
    })
  })

  it('filters route candidates and merges detour metrics from the API', async () => {
    const stations = createMockStations(new Date('2026-03-09T10:00:00.000Z'))
    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const payload = JSON.parse(String(init?.body)) as {
        candidates: Array<{ stationId: string }>
      }

      return {
        ok: true,
        json: async () => ({
          metricsByStationId: Object.fromEntries(
            payload.candidates.map((candidate, index) => [
              candidate.stationId,
              {
                extraDistanceKm: 1.1 + index,
                extraDurationMinutes: 2.4 + index,
              },
            ]),
          ),
        }),
      }
    })

    vi.stubGlobal('fetch', fetchMock)

    const services = createHttpServices()
    const metrics = await services.routeProvider.measureStationDetours(sampleRoute, stations)
    const request = fetchMock.mock.calls[0]?.[1]
    const requestBody = JSON.parse(String(request?.body)) as {
      candidates: Array<{ stationId: string }>
    }

    expect(requestBody.candidates.length).toBeGreaterThan(0)
    expect(Object.keys(metrics).length).toBe(requestBody.candidates.length)
    expect(metrics[requestBody.candidates[0]!.stationId]).toMatchObject({
      stationId: requestBody.candidates[0]!.stationId,
      extraDistanceKm: 1.1,
      extraDurationMinutes: 2.4,
    })
  })

  it('falls back to a default Sydney origin when geolocation is unavailable or denied', async () => {
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })

    const servicesWithoutGeolocation = createHttpServices()

    await expect(
      servicesWithoutGeolocation.currentLocationProvider.getCurrentLocation(),
    ).resolves.toEqual({
      label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
      coordinate: { lat: -33.8731, lng: 151.2065 },
      source: 'current-location',
    })

    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(
          _success: PositionCallback,
          error?: PositionErrorCallback | null,
        ) {
          error?.({} as GeolocationPositionError)
        },
      },
    })

    const servicesWithDeniedGeolocation = createHttpServices()

    await expect(
      servicesWithDeniedGeolocation.currentLocationProvider.getCurrentLocation(),
    ).resolves.toEqual({
      label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
      coordinate: { lat: -33.8731, lng: 151.2065 },
      source: 'current-location',
    })
  })

  it('uses the browser geolocation when it succeeds', async () => {
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({
            coords: {
              latitude: -33.91,
              longitude: 151.18,
            },
          } as GeolocationPosition)
        },
      },
    })

    const services = createHttpServices()

    await expect(services.currentLocationProvider.getCurrentLocation()).resolves.toEqual({
      label: 'Current location',
      coordinate: { lat: -33.91, lng: 151.18 },
      source: 'current-location',
    })
  })
})
