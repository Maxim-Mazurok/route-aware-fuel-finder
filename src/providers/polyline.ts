import type { Coordinate } from '../domain/types'

export function decodePolyline(encoded: string): Coordinate[] {
  const coordinates: Coordinate[] = []
  let index = 0
  let latitude = 0
  let longitude = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let currentByte: number

    do {
      currentByte = encoded.charCodeAt(index++) - 63
      result |= (currentByte & 0x1f) << shift
      shift += 5
    } while (currentByte >= 0x20)

    latitude += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0

    do {
      currentByte = encoded.charCodeAt(index++) - 63
      result |= (currentByte & 0x1f) << shift
      shift += 5
    } while (currentByte >= 0x20)

    longitude += result & 1 ? ~(result >> 1) : result >> 1

    coordinates.push({
      lat: latitude / 1e5,
      lng: longitude / 1e5,
    })
  }

  return coordinates
}
