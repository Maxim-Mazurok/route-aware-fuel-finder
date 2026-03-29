import type { Coordinate, RoutePlan, Station, StationRouteMetrics } from '../domain/types'

export interface ResolvedPlace {
  label: string
  coordinate: Coordinate
  source: 'current-location' | 'saved' | 'mock-geocoder' | 'nominatim' | 'google-geocoding'
}

export interface FuelPriceProvider {
  listStations(): Promise<Station[]>
}

export interface GeocodingProvider {
  resolve(query: string): Promise<ResolvedPlace | null>
}

export type RoutingBackend = 'osrm' | 'google' | 'mock'

export interface RouteOptions {
  avoidTolls?: boolean
}

export interface RouteProvider {
  planRoute(origin: Coordinate, destination: Coordinate, options?: RouteOptions): Promise<RoutePlan>
  measureStationDetours(
    route: RoutePlan,
    stations: Station[],
  ): Promise<Record<string, StationRouteMetrics>>
}

export interface CurrentLocationProvider {
  getCurrentLocation(): Promise<ResolvedPlace>
}

export interface AppServices {
  routingBackend: RoutingBackend
  fuelPriceProvider: FuelPriceProvider
  geocodingProvider: GeocodingProvider
  routeProvider: RouteProvider
  currentLocationProvider: CurrentLocationProvider
  now(): Date
}
