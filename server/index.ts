import 'dotenv/config'
import express from 'express'

import { env } from './lib/env'
import { FuelCheckClient } from './lib/fuelCheck'
import { sendError } from './lib/http'
import { NominatimClient } from './lib/nominatim'
import { OsrmClient } from './lib/osrm'
import type { Coordinate } from '../src/domain/types'
import type { DetourCandidate } from './types'

const fuelCheckClient = new FuelCheckClient({
  apiKey: env.fuelApiKey,
  apiSecret: env.fuelApiSecret,
  baseUrl: env.fuelApiBaseUrl,
})
const nominatimClient = new NominatimClient(
  [
    { baseUrl: env.nominatimBaseUrl },
    ...(env.nominatimFallbackBaseUrl
      ? [
          {
            baseUrl: env.nominatimFallbackBaseUrl,
          },
        ]
      : []),
  ],
  env.nominatimUserAgent,
)
const osrmClient = new OsrmClient(env.osrmBaseUrl)

const app = express()

app.use(express.json())

app.get('/api/health', async (_request, response) => {
  const [nominatimReady, osrmReady] = await Promise.allSettled([
    nominatimClient.healthcheck(),
    osrmClient.healthcheck(),
  ])

  response.json({
    ok: true,
    upstreams: {
      nominatim:
        nominatimReady.status === 'fulfilled' ? nominatimReady.value : false,
      osrm: osrmReady.status === 'fulfilled' ? osrmReady.value : false,
    },
  })
})

app.get('/api/fuel/stations', async (request, response) => {
  try {
    const { stations, fetchedAt } = await fuelCheckClient.getStations(
      request.query.refresh === '1',
    )

    response.json({ stations, fetchedAt })
  } catch (error) {
    sendError(
      response,
      502,
      error instanceof Error ? error.message : 'Could not load NSW fuel data',
    )
  }
})

app.get('/api/geocode', async (request, response) => {
  const query = String(request.query.query ?? '').trim()

  if (!query) {
    sendError(response, 400, 'Missing geocode query')
    return
  }

  try {
    const result = await nominatimClient.resolve(query)

    if (!result) {
      response.status(404).json({ error: 'No matching place found' })
      return
    }

    response.json(result)
  } catch (error) {
    sendError(
      response,
      502,
      error instanceof Error ? error.message : 'Geocoding failed',
    )
  }
})

app.post('/api/route/plan', async (request, response) => {
  const { origin, destination } = request.body as {
    origin?: Coordinate
    destination?: Coordinate
  }

  if (!origin || !destination) {
    sendError(response, 400, 'Origin and destination are required')
    return
  }

  try {
    const route = await osrmClient.planRoute(origin, destination)
    response.json(route)
  } catch (error) {
    sendError(
      response,
      502,
      error instanceof Error ? error.message : 'Route planning failed',
    )
  }
})

app.post('/api/route/detours', async (request, response) => {
  const { origin, destination, candidates } = request.body as {
    origin?: Coordinate
    destination?: Coordinate
    candidates?: DetourCandidate[]
  }

  if (!origin || !destination || !candidates) {
    sendError(response, 400, 'Origin, destination, and candidates are required')
    return
  }

  try {
    const metricsByStationId = await osrmClient.measureDetours(
      origin,
      destination,
      candidates,
    )
    response.json({ metricsByStationId })
  } catch (error) {
    sendError(
      response,
      502,
      error instanceof Error ? error.message : 'Detour calculation failed',
    )
  }
})

app.listen(env.port, () => {
  console.log(`API listening on http://127.0.0.1:${env.port}`)
})
