interface Environment {
  FUEL_API_KEY: string
  FUEL_API_SECRET: string
  FUEL_API_BASE_URL: string
  ALLOWED_ORIGINS: string
}

interface FuelCheckStationRecord {
  brandid?: string
  stationid?: string
  brand: string
  code: string | number
  name: string
  address: string
  location: {
    latitude: number
    longitude: number
  }
}

interface FuelCheckPriceRecord {
  stationcode: string | number
  fueltype: string
  price: number
  lastupdated: string
}

interface FuelCheckResponse {
  stations: FuelCheckStationRecord[]
  prices: FuelCheckPriceRecord[]
}

interface Coordinate {
  lat: number
  lng: number
}

interface FuelOffer {
  fuelCode: string
  priceCentsPerLitre: number
  updatedAt: string
}

interface Station {
  id: string
  brand: string
  name: string
  address: string
  coordinate: Coordinate
  fuelOffers: FuelOffer[]
}

let tokenCache: { value: string; expiresAt: number } | null = null

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

function normalizeFuelCheckDate(rawValue: string) {
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

function normalizeFuelCheckPayload(payload: FuelCheckResponse): Station[] {
  const stationMap = new Map<string, Station>()

  for (const station of payload.stations) {
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
  }

  for (const price of payload.prices) {
    const station = stationMap.get(String(price.stationcode))

    if (!station || typeof price.price !== 'number') {
      continue
    }

    station.fuelOffers.push({
      fuelCode: price.fueltype,
      priceCentsPerLitre: price.price,
      updatedAt: normalizeFuelCheckDate(price.lastupdated),
    })
  }

  return [...stationMap.values()].filter(
    (station) => station.fuelOffers.length > 0,
  )
}

async function getAccessToken(environment: Environment): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value
  }

  const header = btoa(
    `${environment.FUEL_API_KEY}:${environment.FUEL_API_SECRET}`,
  )
  const response = await fetch(
    `${environment.FUEL_API_BASE_URL}/oauth/client_credential/accesstoken?grant_type=client_credentials`,
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
  const expiresInMilliseconds = (Number(payload.expires_in) - 60) * 1_000

  tokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + expiresInMilliseconds,
  }

  return payload.access_token
}

async function fetchStations(
  environment: Environment,
): Promise<{ stations: Station[]; fetchedAt: string }> {
  const token = await getAccessToken(environment)

  const response = await fetch(
    `${environment.FUEL_API_BASE_URL}/FuelPriceCheck/v2/fuel/prices?states=NSW`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
        apikey: environment.FUEL_API_KEY,
        transactionid: crypto.randomUUID(),
        requesttimestamp: formatRequestTimestamp(new Date()),
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Fuel API fetch failed with status ${response.status}`)
  }

  const payload = (await response.json()) as FuelCheckResponse
  const stations = normalizeFuelCheckPayload(payload)

  return { stations, fetchedAt: new Date().toISOString() }
}

function corsHeaders(
  environment: Environment,
  request: Request,
): Record<string, string> {
  const allowedOrigins = environment.ALLOWED_ORIGINS || '*'
  const requestOrigin = request.headers.get('Origin') || ''

  let effectiveOrigin = '*'
  if (allowedOrigins !== '*') {
    const allowed = allowedOrigins.split(',').map((origin) => origin.trim())
    if (allowed.includes(requestOrigin)) {
      effectiveOrigin = requestOrigin
    } else {
      effectiveOrigin = allowed[0] || '*'
    }
  }

  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(
    request: Request,
    environment: Environment,
  ): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(environment, request),
      })
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(environment, request),
        },
      })
    }

    const cacheUrl = new URL(request.url)
    cacheUrl.pathname = '/stations'
    const cacheKey = new Request(cacheUrl.toString())
    const cache = caches.default

    const cached = await cache.match(cacheKey)
    if (cached) {
      const response = new Response(cached.body, cached)
      for (const [key, value] of Object.entries(
        corsHeaders(environment, request),
      )) {
        response.headers.set(key, value)
      }
      return response
    }

    try {
      const { stations, fetchedAt } = await fetchStations(environment)

      const response = new Response(
        JSON.stringify({ stations, fetchedAt }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 's-maxage=1800',
            ...corsHeaders(environment, request),
          },
        },
      )

      await cache.put(cacheKey, response.clone())

      return response
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch fuel data'
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(environment, request),
        },
      })
    }
  },
}
