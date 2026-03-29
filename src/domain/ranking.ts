import { averageAllowedPrice, chooseBestOffer, computeFillLitres, estimatedRangeKm } from './fuel'
import { computeEffectivePrice, DEFAULT_PRICE_ADJUSTMENTS } from './loyalty'
import type {
  FillStrategy,
  PriceAdjustments,
  RankedStation,
  RankingPreferences,
  RoutePlan,
  Station,
  StationRouteMetrics,
  VehicleProfile,
} from './types'

function hoursBetween(now: Date, updatedAt: string) {
  return Math.max(0, (now.getTime() - new Date(updatedAt).getTime()) / 36e5)
}

export interface BuildRankedStationsArgs {
  now: Date
  stations: Station[]
  route: RoutePlan
  metricsByStationId: Record<string, StationRouteMetrics>
  vehicle: VehicleProfile
  fillStrategy: FillStrategy
  preferences: RankingPreferences
  priceAdjustments?: PriceAdjustments
}

export function buildRankedStations({
  now,
  stations,
  route,
  metricsByStationId,
  vehicle,
  fillStrategy,
  preferences,
  priceAdjustments = DEFAULT_PRICE_ADJUSTMENTS,
}: BuildRankedStationsArgs) {
  const referencePrice = averageAllowedPrice(stations, vehicle.allowedFuelCodes)
  const reachableRangeKm = estimatedRangeKm(vehicle)
  const reserveKm = Math.max(18, reachableRangeKm * 0.08)

  const ranked = stations
    .map((station): RankedStation | null => {
      const chosenOffer = chooseBestOffer(station, vehicle.allowedFuelCodes)

      if (!chosenOffer) {
        return null
      }

      const metrics = metricsByStationId[station.id]

      if (!metrics) {
        return null
      }

      const ageHours = hoursBetween(now, chosenOffer.updatedAt)

      const {
        effectivePriceCentsPerLitre,
        discountCentsPerLitre,
        surchargeCentsPerLitre,
        appliedProgramName,
      } = computeEffectivePrice(
        chosenOffer.priceCentsPerLitre,
        station.brand,
        priceAdjustments,
      )

      const fillLitres = computeFillLitres(
        fillStrategy,
        vehicle,
        effectivePriceCentsPerLitre,
      )
      const fillCostDollars = (fillLitres * effectivePriceCentsPerLitre) / 100
      const detourFuelLitres =
        (metrics.extraDistanceKm * vehicle.consumptionLitresPer100Km) / 100
      const detourFuelCostDollars =
        (detourFuelLitres * referencePrice) / 100
      const timePenaltyDollars =
        (metrics.extraDurationMinutes / 60) * preferences.timeValueDollarsPerHour
      const freshnessPenaltyDollars =
        ageHours > 36 ? ((ageHours - 36) / 24) * 0.65 : 0
      const reachable =
        metrics.distanceFromOriginKm <= Math.max(0, reachableRangeKm - reserveKm)

      if (
        (preferences.maxExtraMinutes !== null &&
          metrics.extraDurationMinutes > preferences.maxExtraMinutes) ||
        (preferences.maxExtraKilometres !== null &&
          metrics.extraDistanceKm > preferences.maxExtraKilometres)
      ) {
        return {
          station,
          chosenOffer,
          fillLitres,
          fillCostDollars,
          detourFuelCostDollars,
          timePenaltyDollars,
          freshnessPenaltyDollars,
          effectiveStopCostDollars: Number.POSITIVE_INFINITY,
          extraDistanceKm: metrics.extraDistanceKm,
          extraDurationMinutes: metrics.extraDurationMinutes,
          distanceFromOriginKm: metrics.distanceFromOriginKm,
          ageHours,
          reachable,
          effectivePriceCentsPerLitre,
          discountCentsPerLitre,
          surchargeCentsPerLitre,
          appliedProgramName,
          excludedReason: 'detour',
        }
      }

      if (preferences.maxPriceAgeHours && ageHours > preferences.maxPriceAgeHours) {
        return {
          station,
          chosenOffer,
          fillLitres,
          fillCostDollars,
          detourFuelCostDollars,
          timePenaltyDollars,
          freshnessPenaltyDollars,
          effectiveStopCostDollars: Number.POSITIVE_INFINITY,
          extraDistanceKm: metrics.extraDistanceKm,
          extraDurationMinutes: metrics.extraDurationMinutes,
          distanceFromOriginKm: metrics.distanceFromOriginKm,
          ageHours,
          reachable,
          effectivePriceCentsPerLitre,
          discountCentsPerLitre,
          surchargeCentsPerLitre,
          appliedProgramName,
          excludedReason: 'stale',
        }
      }

      const routeBurnPenaltyDollars =
        route.distanceKm > 0
          ? (metrics.distanceToRouteKm / route.distanceKm) * 0.5
          : 0
      const effectiveStopCostDollars =
        fillCostDollars +
        detourFuelCostDollars +
        timePenaltyDollars +
        freshnessPenaltyDollars +
        routeBurnPenaltyDollars +
        (reachable ? 0 : 22)

      return {
        station,
        chosenOffer,
        fillLitres,
        fillCostDollars,
        detourFuelCostDollars,
        timePenaltyDollars,
        freshnessPenaltyDollars,
        effectiveStopCostDollars,
        extraDistanceKm: metrics.extraDistanceKm,
        extraDurationMinutes: metrics.extraDurationMinutes,
        distanceFromOriginKm: metrics.distanceFromOriginKm,
        ageHours,
        reachable,
        effectivePriceCentsPerLitre,
        discountCentsPerLitre,
        surchargeCentsPerLitre,
        appliedProgramName,
      }
    })
    .filter((station): station is RankedStation => station !== null)
    .filter((station) => {
      if (station.excludedReason) {
        return false
      }

      if (preferences.hideUnreachable && !station.reachable) {
        return false
      }

      return true
    })

  return ranked.sort((left, right) => {
    switch (preferences.sortMode) {
      case 'pump-price':
        return (
          left.effectivePriceCentsPerLitre - right.effectivePriceCentsPerLitre
        )
      case 'extra-time':
        return left.extraDurationMinutes - right.extraDurationMinutes
      case 'extra-distance':
        return left.extraDistanceKm - right.extraDistanceKm
      case 'freshness':
        return left.ageHours - right.ageHours
      case 'recommended':
      default:
        return left.effectiveStopCostDollars - right.effectiveStopCostDollars
    }
  })
}
