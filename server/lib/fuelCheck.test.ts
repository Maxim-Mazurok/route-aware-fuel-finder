import { afterEach, describe, expect, it, vi } from 'vitest'

import { FuelCheckClient, normalizeFuelCheckDate, normalizeFuelCheckPayload } from './fuelCheck'

describe('FuelCheck normalization', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes the mixed FuelCheck date formats into ISO strings', () => {
    expect(normalizeFuelCheckDate('08/03/2026 09:15:49')).toBe(
      '2026-03-08T09:15:49.000Z',
    )
    expect(normalizeFuelCheckDate('2026-03-09 10:07:37')).toBe(
      '2026-03-09T10:07:37.000Z',
    )
  })

  it('handles 12-hour timestamps and invalid fallbacks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-09T11:00:00.000Z'))

    expect(normalizeFuelCheckDate('09/03/2026 12:07:37 AM')).toBe(
      '2026-03-09T00:07:37.000Z',
    )
    expect(normalizeFuelCheckDate('09/03/2026 12:07:37 PM')).toBe(
      '2026-03-09T12:07:37.000Z',
    )
    expect(normalizeFuelCheckDate('not a date')).toBe('2026-03-09T11:00:00.000Z')

    vi.useRealTimers()
  })

  it('joins station and price rows into app stations', () => {
    const stations = normalizeFuelCheckPayload({
      stations: [
        {
          brand: 'BP',
          code: '1796',
          stationid: '1-GPPT-839',
          name: 'BP Redfern',
          address: '411 Cleveland Street, Redfern NSW 2016',
          location: { latitude: -33.891804, longitude: 151.213294 },
        },
      ],
      prices: [
        {
          stationcode: '1796',
          fueltype: 'U91',
          price: 217.9,
          lastupdated: '2026-03-03 21:05:25',
        },
      ],
    })

    expect(stations).toHaveLength(1)
    expect(stations[0]?.fuelOffers[0]?.fuelCode).toBe('U91')
  })

  it('drops prices without a station match or numeric price', () => {
    const stations = normalizeFuelCheckPayload({
      stations: [
        {
          brand: 'Ampol',
          code: '100',
          stationid: 'station-100',
          name: 'Ampol Test',
          address: '1 Test Street, Sydney NSW 2000',
          location: { latitude: -33.87, longitude: 151.21 },
        },
      ],
      prices: [
        {
          stationcode: '100',
          fueltype: 'U91',
          price: 'oops' as unknown as number,
          lastupdated: '2026-03-03 21:05:25',
        },
        {
          stationcode: '404',
          fueltype: 'U91',
          price: 199.9,
          lastupdated: '2026-03-03 21:05:25',
        },
      ],
    })

    expect(stations).toHaveLength(0)
  })
})

describe('FuelCheckClient', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reuses the access token and station cache until refresh is forced', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-09T10:00:00.000Z'))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: '3600',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stations: [
            {
              brand: 'BP',
              code: '1796',
              stationid: '1-GPPT-839',
              name: 'BP Redfern',
              address: '411 Cleveland Street, Redfern NSW 2016',
              location: { latitude: -33.891804, longitude: 151.213294 },
            },
          ],
          prices: [
            {
              stationcode: '1796',
              fueltype: 'U91',
              price: 217.9,
              lastupdated: '2026-03-03 21:05:25',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stations: [
            {
              brand: 'BP',
              code: '1796',
              stationid: '1-GPPT-839',
              name: 'BP Redfern',
              address: '411 Cleveland Street, Redfern NSW 2016',
              location: { latitude: -33.891804, longitude: 151.213294 },
            },
          ],
          prices: [
            {
              stationcode: '1796',
              fueltype: 'U91',
              price: 219.9,
              lastupdated: '2026-03-04 09:05:25',
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const client = new FuelCheckClient({
      apiKey: 'key',
      apiSecret: 'secret',
      baseUrl: 'https://example.com',
    })

    const first = await client.getStations()
    const second = await client.getStations()
    const third = await client.getStations(true)

    expect(first.stations[0]?.fuelOffers[0]?.priceCentsPerLitre).toBe(217.9)
    expect(second.stations[0]?.fuelOffers[0]?.priceCentsPerLitre).toBe(217.9)
    expect(third.stations[0]?.fuelOffers[0]?.priceCentsPerLitre).toBe(219.9)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws a readable error when auth fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    )

    const client = new FuelCheckClient({
      apiKey: 'key',
      apiSecret: 'secret',
      baseUrl: 'https://example.com',
    })

    await expect(client.getStations()).rejects.toThrow(/auth failed with status 401/i)
  })

  it('throws a readable error when the station fetch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: '3600',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

    vi.stubGlobal('fetch', fetchMock)

    const client = new FuelCheckClient({
      apiKey: 'key',
      apiSecret: 'secret',
      baseUrl: 'https://example.com',
    })

    await expect(client.getStations()).rejects.toThrow(/fetch failed with status 503/i)
  })
})
