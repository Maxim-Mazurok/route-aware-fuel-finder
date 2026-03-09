export type FuelCode = string

export interface Coordinate {
  lat: number
  lng: number
}

export interface FuelOffer {
  fuelCode: FuelCode
  priceCentsPerLitre: number
  updatedAt: string
}

export interface Station {
  id: string
  brand: string
  name: string
  address: string
  coordinate: Coordinate
  fuelOffers: FuelOffer[]
}

export interface VehicleProfile {
  tankCapacityLitres: number
  currentFuelLitres: number
  consumptionLitresPer100Km: number
  allowedFuelCodes: FuelCode[]
}

export type FillStrategy =
  | { kind: 'full' }
  | { kind: 'litres'; litres: number }
  | { kind: 'percentage'; targetPercent: number }
  | { kind: 'budget'; amountDollars: number }

export interface RoutePlan {
  origin: Coordinate
  destination: Coordinate
  path: Coordinate[]
  distanceKm: number
  durationMinutes: number
}

export interface StationRouteMetrics {
  stationId: string
  routeProgress: number
  distanceFromOriginKm: number
  distanceToRouteKm: number
  extraDistanceKm: number
  extraDurationMinutes: number
}

export type SortMode =
  | 'recommended'
  | 'pump-price'
  | 'extra-time'
  | 'extra-distance'
  | 'freshness'

export interface RankingPreferences {
  timeValueDollarsPerHour: number
  maxExtraMinutes: number | null
  maxExtraKilometres: number | null
  hideUnreachable: boolean
  maxPriceAgeHours?: number | null
  sortMode: SortMode
}

export interface RankedStation {
  station: Station
  chosenOffer: FuelOffer
  fillLitres: number
  fillCostDollars: number
  detourFuelCostDollars: number
  timePenaltyDollars: number
  freshnessPenaltyDollars: number
  effectiveStopCostDollars: number
  extraDistanceKm: number
  extraDurationMinutes: number
  distanceFromOriginKm: number
  ageHours: number
  reachable: boolean
  excludedReason?: 'fuel' | 'detour' | 'stale'
}
