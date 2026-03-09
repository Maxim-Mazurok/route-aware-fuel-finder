import type { FillStrategy, FuelOffer, FuelCode, Station, VehicleProfile } from './types'

export const DEFAULT_ALLOWED_FUELS: FuelCode[] = ['U91', 'P95', 'P98']

export function currentFuelLitres(vehicle: VehicleProfile) {
  return Math.max(0, vehicle.currentFuelLitres)
}

export function computeFillLitres(
  strategy: FillStrategy,
  vehicle: VehicleProfile,
  priceCentsPerLitre: number,
) {
  const currentLitres = currentFuelLitres(vehicle)
  const remainingCapacity = Math.max(0, vehicle.tankCapacityLitres - currentLitres)

  switch (strategy.kind) {
    case 'full':
      return remainingCapacity
    case 'litres':
      return Math.min(remainingCapacity, Math.max(0, strategy.litres))
    case 'percentage': {
      const targetLitres = (vehicle.tankCapacityLitres * strategy.targetPercent) / 100
      return Math.min(remainingCapacity, Math.max(0, targetLitres - currentLitres))
    }
    case 'budget':
      return Math.min(
        remainingCapacity,
        Math.max(0, strategy.amountDollars / (priceCentsPerLitre / 100)),
      )
  }
}

export function chooseBestOffer(
  station: Station,
  allowedFuelCodes: FuelCode[],
) {
  const allowedSet = new Set(allowedFuelCodes)
  const offers = station.fuelOffers.filter((offer) => allowedSet.has(offer.fuelCode))

  if (offers.length === 0) {
    return null
  }

  return [...offers].sort(
    (left, right) => left.priceCentsPerLitre - right.priceCentsPerLitre,
  )[0]
}

export function averageAllowedPrice(stations: Station[], allowedFuelCodes: FuelCode[]) {
  const offers = stations
    .map((station) => chooseBestOffer(station, allowedFuelCodes))
    .filter((offer): offer is FuelOffer => offer !== null)

  if (offers.length === 0) {
    return 210
  }

  const total = offers.reduce((sum, offer) => sum + offer.priceCentsPerLitre, 0)
  return total / offers.length
}

export function estimatedRangeKm(vehicle: VehicleProfile) {
  if (vehicle.consumptionLitresPer100Km <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return (currentFuelLitres(vehicle) / vehicle.consumptionLitresPer100Km) * 100
}
