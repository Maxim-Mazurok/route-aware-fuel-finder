import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatCoordinate, NominatimClient } from './nominatim'

describe('NominatimClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('falls back to the public endpoint when the local endpoint is unavailable', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            display_name: 'Parramatta Station, Parramatta, NSW, Australia',
            lat: '-33.8176',
            lon: '151.0053',
          },
        ],
      })

    vi.stubGlobal('fetch', fetchMock)

    const client = new NominatimClient(
      [
        { baseUrl: 'http://127.0.0.1:8080' },
        { baseUrl: 'https://nominatim.openstreetmap.org' },
      ],
      'route-aware-fuel-finder-test',
    )

    await expect(client.resolve('Parramatta Station NSW')).resolves.toEqual({
      label: 'Parramatta Station, Parramatta, NSW, Australia',
      coordinate: {
        lat: -33.8176,
        lng: 151.0053,
      },
      source: 'nominatim',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null when every configured endpoint reports no match', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    vi.stubGlobal('fetch', fetchMock)

    const client = new NominatimClient(
      [{ baseUrl: 'http://127.0.0.1:8080' }],
      'route-aware-fuel-finder-test',
    )

    await expect(client.resolve('Unknown Place')).resolves.toBeNull()
  })

  it('throws the last endpoint error when every endpoint fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
      })
      .mockRejectedValueOnce(new Error('socket hang up'))

    vi.stubGlobal('fetch', fetchMock)

    const client = new NominatimClient(
      [
        { baseUrl: 'http://127.0.0.1:8080' },
        { baseUrl: 'https://nominatim.openstreetmap.org' },
      ],
      'route-aware-fuel-finder-test',
    )

    await expect(client.resolve('Broken Place')).rejects.toThrow(/socket hang up/i)
  })

  it('reports healthy when any endpoint answers the status probe', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({
        ok: true,
      })

    vi.stubGlobal('fetch', fetchMock)

    const client = new NominatimClient(
      [
        { baseUrl: 'http://127.0.0.1:8080' },
        { baseUrl: 'https://nominatim.openstreetmap.org' },
      ],
      'route-aware-fuel-finder-test',
    )

    await expect(client.healthcheck()).resolves.toBe(true)
  })

  it('reports unhealthy when every status probe fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    )

    const client = new NominatimClient(
      [{ baseUrl: 'http://127.0.0.1:8080' }],
      'route-aware-fuel-finder-test',
    )

    await expect(client.healthcheck()).resolves.toBe(false)
  })
})

describe('formatCoordinate', () => {
  it('formats longitude before latitude for OSRM-style query strings', () => {
    expect(formatCoordinate({ lat: -33.8731, lng: 151.2065 })).toBe(
      '151.2065,-33.8731',
    )
  })
})
