import type { Coordinate, RoutePlan, Station, StationRouteMetrics } from '../domain/types'

export interface ResolvedPlace {
  label: string
  coordinate: Coordinate
  source: 'current-location' | 'saved' | 'mock-geocoder' | 'nominatim'
}

export interface FuelPriceProvider {
  listStations(): Promise<Station[]>
}

export interface GeocodingProvider {
  resolve(query: string): Promise<ResolvedPlace | null>
}

export interface RouteProvider {
  planRoute(origin: Coordinate, destination: Coordinate): Promise<RoutePlan>
  measureStationDetours(
    route: RoutePlan,
    stations: Station[],
  ): Promise<Record<string, StationRouteMetrics>>
}

export interface CurrentLocationProvider {
  getCurrentLocation(): Promise<ResolvedPlace>
}

export interface AppServices {
  fuelPriceProvider: FuelPriceProvider
  geocodingProvider: GeocodingProvider
  routeProvider: RouteProvider
  currentLocationProvider: CurrentLocationProvider
  now(): Date
}
