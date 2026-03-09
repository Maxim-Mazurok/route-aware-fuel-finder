import { useEffect } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import { latLngBounds } from 'leaflet'

import { formatFuelCode } from '../domain/format'
import type { RankedStation, RoutePlan } from '../domain/types'

interface StationMapProps {
  route: RoutePlan
  stations: RankedStation[]
}

function FitBounds({
  route,
  stations,
}: StationMapProps) {
  const map = useMap()

  useEffect(() => {
    const points = [
      ...route.path,
      ...stations.slice(0, 6).map((station) => station.station.coordinate),
    ]

    if (points.length === 0) {
      return
    }

    map.fitBounds(
      latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])).pad(
        0.18,
      ),
      { animate: false },
    )
  }, [map, route.path, stations])

  return null
}

export function StationMap({ route, stations }: StationMapProps) {
  if (import.meta.env.MODE === 'test') {
    return (
      <div className="map-panel map-panel--test" data-testid="route-map">
        Map preview is disabled in unit tests.
      </div>
    )
  }

  return (
    <div className="map-panel">
      <MapContainer
        center={[route.origin.lat, route.origin.lng]}
        zoom={11}
        scrollWheelZoom={false}
        className="leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds route={route} stations={stations} />
        <Polyline
          positions={route.path.map((point) => [point.lat, point.lng] as [number, number])}
          pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.75 }}
        />

        <CircleMarker
          center={[route.origin.lat, route.origin.lng]}
          radius={8}
          pathOptions={{ color: '#1e293b', fillColor: '#1e293b', fillOpacity: 0.95 }}
        >
          <Popup>Current location</Popup>
        </CircleMarker>

        <CircleMarker
          center={[route.destination.lat, route.destination.lng]}
          radius={8}
          pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.95 }}
        >
          <Popup>Destination</Popup>
        </CircleMarker>

        {stations.slice(0, 6).map((station, index) => (
          <CircleMarker
            key={station.station.id}
            center={[station.station.coordinate.lat, station.station.coordinate.lng]}
            radius={index === 0 ? 9 : 7}
            pathOptions={{
              color: index === 0 ? '#0f766e' : '#22c55e',
              fillColor: index === 0 ? '#0f766e' : '#22c55e',
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              <strong>{station.station.name}</strong>
              <br />
              {formatFuelCode(station.chosenOffer.fuelCode)} at{' '}
              {station.chosenOffer.priceCentsPerLitre.toFixed(1)} c/L
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
