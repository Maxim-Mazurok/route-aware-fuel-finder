import type { Coordinate } from './types'

const EARTH_RADIUS_KM = 6371

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

export function haversineDistanceKm(a: Coordinate, b: Coordinate) {
  const deltaLat = toRadians(b.lat - a.lat)
  const deltaLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function projectPoint(point: Coordinate) {
  const latScale = 111.32
  const lngScale = 111.32 * Math.cos(toRadians(point.lat))
  return {
    x: point.lng * lngScale,
    y: point.lat * latScale,
  }
}

export function interpolateRoutePath(
  origin: Coordinate,
  destination: Coordinate,
  samples = 24,
) {
  const controlPoint = {
    lat: origin.lat * 0.58 + destination.lat * 0.42,
    lng:
      origin.lng * 0.58 +
      destination.lng * 0.42 +
      Math.sign(destination.lat - origin.lat || 1) *
        Math.min(0.05, haversineDistanceKm(origin, destination) / 250),
  }

  return Array.from({ length: samples + 1 }, (_, index) => {
    const t = index / samples
    const oneMinusT = 1 - t
    return {
      lat:
        oneMinusT * oneMinusT * origin.lat +
        2 * oneMinusT * t * controlPoint.lat +
        t * t * destination.lat,
      lng:
        oneMinusT * oneMinusT * origin.lng +
        2 * oneMinusT * t * controlPoint.lng +
        t * t * destination.lng,
    }
  })
}

export function pathDistanceKm(path: Coordinate[]) {
  return path.slice(1).reduce((total, point, index) => {
    return total + haversineDistanceKm(path[index], point)
  }, 0)
}

export function closestPointOnSegment(
  point: Coordinate,
  start: Coordinate,
  end: Coordinate,
) {
  const projectedPoint = projectPoint(point)
  const projectedStart = projectPoint(start)
  const projectedEnd = projectPoint(end)

  const segmentX = projectedEnd.x - projectedStart.x
  const segmentY = projectedEnd.y - projectedStart.y
  const lengthSquared = segmentX * segmentX + segmentY * segmentY

  if (lengthSquared === 0) {
    return { point: start, fraction: 0, distanceKm: haversineDistanceKm(point, start) }
  }

  const rawProjection =
    ((projectedPoint.x - projectedStart.x) * segmentX +
      (projectedPoint.y - projectedStart.y) * segmentY) /
    lengthSquared
  const fraction = Math.max(0, Math.min(1, rawProjection))

  const closest = {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction,
  }

  return {
    point: closest,
    fraction,
    distanceKm: haversineDistanceKm(point, closest),
  }
}

export function nearestPointOnPath(point: Coordinate, path: Coordinate[]) {
  let bestDistance = Number.POSITIVE_INFINITY
  let bestProgress = 0
  let travelledKm = 0
  let bestDistanceFromOrigin = 0

  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index]
    const end = path[index + 1]
    const segmentDistance = haversineDistanceKm(start, end)
    const candidate = closestPointOnSegment(point, start, end)

    if (candidate.distanceKm < bestDistance) {
      bestDistance = candidate.distanceKm
      bestDistanceFromOrigin = travelledKm + segmentDistance * candidate.fraction
      bestProgress = travelledKm + segmentDistance * candidate.fraction
    }

    travelledKm += segmentDistance
  }

  return {
    distanceKm: bestDistance,
    distanceFromOriginKm: bestDistanceFromOrigin,
    progressDistanceKm: bestProgress,
  }
}
