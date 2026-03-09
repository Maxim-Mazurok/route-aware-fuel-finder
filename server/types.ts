import type { Coordinate, RoutePlan, Station, StationRouteMetrics } from '../src/domain/types'

export interface FuelCheckStationRecord {
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
  state?: string
}

export interface FuelCheckPriceRecord {
  stationcode: string | number
  fueltype: string
  price: number
  lastupdated: string
  priceunit?: string
  state?: string
}

export interface FuelCheckResponse {
  stations: FuelCheckStationRecord[]
  prices: FuelCheckPriceRecord[]
}

export interface ResolvedPlaceDto {
  label: string
  coordinate: Coordinate
  source: 'current-location' | 'saved' | 'nominatim'
}

export type RoutePlanDto = RoutePlan

export interface DetourCandidate {
  stationId: string
  coordinate: Coordinate
}

export interface DetourMetricsResponse {
  metricsByStationId: Record<string, Pick<StationRouteMetrics, 'extraDistanceKm' | 'extraDurationMinutes'>>
}

export interface FuelStationsResponse {
  stations: Station[]
  fetchedAt: string
}
