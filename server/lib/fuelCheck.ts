import { randomUUID } from 'node:crypto'

import type { Station } from '../../src/domain/types'
import type { FuelCheckResponse } from '../types'

const CACHE_TTL_MS = 30 * 60 * 1000

function formatRequestTimestamp(date: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(',', '')
}

export function normalizeFuelCheckDate(rawValue: string) {
  const trimmed = rawValue.trim()
  const isoLike = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  )

  if (isoLike) {
    const [, year, month, day, hours, minutes, seconds] = isoLike
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
      ),
    ).toISOString()
  }

  const parts = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s+(AM|PM))?$/,
  )

  if (!parts) {
    return new Date().toISOString()
  }

  const [, day, month, year, rawHours, minutes, seconds, meridiem] = parts
  let hours = Number(rawHours)

  if (meridiem) {
    if (meridiem === 'PM' && hours < 12) {
      hours += 12
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0
    }
  }

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      hours,
      Number(minutes),
      Number(seconds),
    ),
  ).toISOString()
}

export function normalizeFuelCheckPayload(payload: FuelCheckResponse): Station[] {
  const stationMap = new Map<string, Station>()

  payload.stations.forEach((station) => {
    const stationCode = String(station.code)
    stationMap.set(stationCode, {
      id: station.stationid || stationCode,
      brand: station.brand,
      name: station.name,
      address: station.address,
      coordinate: {
        lat: Number(station.location.latitude),
        lng: Number(station.location.longitude),
      },
      fuelOffers: [],
    })
  })

  payload.prices.forEach((price) => {
    const station = stationMap.get(String(price.stationcode))

    if (!station || typeof price.price !== 'number') {
      return
    }

    station.fuelOffers.push({
      fuelCode: price.fueltype,
      priceCentsPerLitre: price.price,
      updatedAt: normalizeFuelCheckDate(price.lastupdated),
    })
  })

  return [...stationMap.values()].filter((station) => station.fuelOffers.length > 0)
}

interface TokenCache {
  value: string
  expiresAt: number
}

interface StationCache {
  stations: Station[]
  fetchedAt: string
  expiresAt: number
}

export class FuelCheckClient {
  private tokenCache: TokenCache | null = null
  private stationCache: StationCache | null = null

  constructor(
    private readonly options: {
      apiKey: string
      apiSecret: string
      baseUrl: string
    },
  ) {}

  private async getAccessToken() {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.value
    }

    const header = Buffer.from(
      `${this.options.apiKey}:${this.options.apiSecret}`,
      'utf8',
    ).toString('base64')
    const response = await fetch(
      `${this.options.baseUrl}/oauth/client_credential/accesstoken?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${header}`,
          Accept: 'application/json',
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Fuel API auth failed with status ${response.status}`)
    }

    const payload = (await response.json()) as {
      access_token: string
      expires_in: string
    }
    const expiresInMs = (Number(payload.expires_in) - 60) * 1000

    this.tokenCache = {
      value: payload.access_token,
      expiresAt: Date.now() + expiresInMs,
    }

    return payload.access_token
  }

  async getStations(forceRefresh = false) {
    if (!forceRefresh && this.stationCache && Date.now() < this.stationCache.expiresAt) {
      return {
        stations: this.stationCache.stations,
        fetchedAt: this.stationCache.fetchedAt,
      }
    }

    const token = await this.getAccessToken()
    const response = await fetch(`${this.options.baseUrl}/FuelPriceCheck/v2/fuel/prices?states=NSW`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
        apikey: this.options.apiKey,
        transactionid: randomUUID(),
        requesttimestamp: formatRequestTimestamp(new Date()),
      },
    })

    if (!response.ok) {
      throw new Error(`Fuel API fetch failed with status ${response.status}`)
    }

    const payload = (await response.json()) as FuelCheckResponse
    const stations = normalizeFuelCheckPayload(payload)
    const fetchedAt = new Date().toISOString()

    this.stationCache = {
      stations,
      fetchedAt,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }

    return { stations, fetchedAt }
  }
}
