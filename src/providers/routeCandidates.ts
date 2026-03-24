import { nearestPointOnPath } from '../domain/geo'
import type { RoutePlan, Station } from '../domain/types'

export function corridorCandidateMetrics(route: RoutePlan, station: Station) {
  const nearest = nearestPointOnPath(station.coordinate, route.path)
  const routeProgress =
    route.distanceKm === 0 ? 0 : nearest.progressDistanceKm / route.distanceKm

  return {
    stationId: station.id,
    routeProgress,
    distanceFromOriginKm: nearest.distanceFromOriginKm,
    distanceToRouteKm: nearest.distanceKm,
  }
}

export function pickRouteCandidates(route: RoutePlan, stations: Station[]) {
  const routeLength = route.distanceKm
  const corridorKm = Math.min(7, Math.max(1.2, routeLength * 0.08))

  return stations
    .map((station) => ({
      station,
      metrics: corridorCandidateMetrics(route, station),
    }))
    .filter(
      ({ metrics }) =>
        metrics.distanceToRouteKm <= corridorKm &&
        metrics.routeProgress >= -0.05 &&
        metrics.routeProgress <= 1.15,
    )
    .sort((left, right) => {
      const leftScore =
        left.metrics.distanceToRouteKm * 2 + Math.abs(0.55 - left.metrics.routeProgress)
      const rightScore =
        right.metrics.distanceToRouteKm * 2 + Math.abs(0.55 - right.metrics.routeProgress)
      return leftScore - rightScore
    })
    .slice(0, 36)
}
