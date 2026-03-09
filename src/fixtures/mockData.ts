import type { Coordinate, FuelCode, Station } from '../domain/types'

interface PlaceSeed {
  label: string
  coordinate: Coordinate
  aliases: string[]
}

interface FuelOfferSeed {
  fuelCode: FuelCode
  priceCentsPerLitre: number
  updatedHoursAgo: number
}

interface StationSeed {
  id: string
  brand: string
  name: string
  address: string
  coordinate: Coordinate
  fuelOffers: FuelOfferSeed[]
}

export const KNOWN_PLACES: PlaceSeed[] = [
  {
    label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
    coordinate: { lat: -33.8731, lng: 151.2065 },
    aliases: ['town hall', 'sydney cbd', 'george street sydney', 'sydney town hall'],
  },
  {
    label: 'Parramatta Station, Parramatta NSW 2150',
    coordinate: { lat: -33.8176, lng: 151.0053 },
    aliases: ['parramatta', 'parramatta station'],
  },
  {
    label: 'Newtown Station, Newtown NSW 2042',
    coordinate: { lat: -33.8981, lng: 151.1799 },
    aliases: ['newtown', 'newtown station'],
  },
  {
    label: 'Bondi Junction Station, Bondi Junction NSW 2022',
    coordinate: { lat: -33.8914, lng: 151.2485 },
    aliases: ['bondi junction', 'bondi'],
  },
  {
    label: 'Chatswood Station, Chatswood NSW 2067',
    coordinate: { lat: -33.7969, lng: 151.1824 },
    aliases: ['chatswood', 'chatswood station'],
  },
  {
    label: 'Sydney Airport T1, Mascot NSW 2020',
    coordinate: { lat: -33.9399, lng: 151.1753 },
    aliases: ['airport', 'sydney airport', 'mascot'],
  },
]

const STATION_SEEDS: StationSeed[] = [
  {
    id: 'bp-rozelle',
    brand: 'BP',
    name: 'BP Rozelle',
    address: '178 Victoria Road, Rozelle NSW 2039',
    coordinate: { lat: -33.8628, lng: 151.1692 },
    fuelOffers: [
      { fuelCode: 'U91', priceCentsPerLitre: 204.9, updatedHoursAgo: 2 },
      { fuelCode: 'P95', priceCentsPerLitre: 216.9, updatedHoursAgo: 2 },
      { fuelCode: 'P98', priceCentsPerLitre: 223.9, updatedHoursAgo: 2 },
    ],
  },
  {
    id: 'metro-annandale',
    brand: 'Metro Fuel',
    name: 'Metro Fuel Annandale',
    address: '66 Parramatta Road, Annandale NSW 2038',
    coordinate: { lat: -33.8838, lng: 151.1735 },
    fuelOffers: [
      { fuelCode: 'U91', priceCentsPerLitre: 197.9, updatedHoursAgo: 6 },
      { fuelCode: 'P95', priceCentsPerLitre: 209.9, updatedHoursAgo: 6 },
      { fuelCode: 'P98', priceCentsPerLitre: 217.9, updatedHoursAgo: 6 },
    ],
  },
  {
    id: 'united-ashfield',
    brand: 'United',
    name: 'United Ashfield',
    address: '374 Parramatta Road, Ashfield NSW 2131',
    coordinate: { lat: -33.8891, lng: 151.1363 },
    fuelOffers: [
      { fuelCode: 'U91', priceCentsPerLitre: 198.9, updatedHoursAgo: 4 },
      { fuelCode: 'P95', priceCentsPerLitre: 211.9, updatedHoursAgo: 4 },
      { fuelCode: 'P98', priceCentsPerLitre: 219.9, updatedHoursAgo: 4 },
    ],
  },
  {
    id: 'budget-five-dock',
    brand: 'Budget',
    name: 'Budget Five Dock',
    address: '118 Parramatta Road, Five Dock NSW 2046',
    coordinate: { lat: -33.8675, lng: 151.1278 },
    fuelOffers: [
      { fuelCode: 'U91', priceCentsPerLitre: 194.9, updatedHoursAgo: 18 },
      { fuelCode: 'P95', priceCentsPerLitre: 208.9, updatedHoursAgo: 18 },
      { fuelCode: 'P98', priceCentsPerLitre: 215.9, updatedHoursAgo: 18 },
    ],
  },
  {
    id: 'shell-burwood',
    brand: 'Shell',
    name: 'Shell Burwood',
    address: '184 Parramatta Road, Burwood NSW 2134',
    coordinate: { lat: -33.8763, lng: 151.1039 },
    fuelOffers: [
      { fuelCode: 'U91', priceCentsPerLitre: 199.9, updatedHoursAgo: 12 },
      { fuelCode: 'P95', priceCentsPerLitre: 214.9, updatedHoursAgo: 12 },
      { fuelCode: 'P98', priceCentsPerLitre: 223.9, updatedHoursAgo: 12 },
    ],
  },
  {
    id: 'ampol-homebush',
    brand: 'Ampol',
    name: 'Ampol Homebush',
    address: '251 Parramatta Road, Homebush NSW 2140',
    coordinate: { lat: -33.8658, lng: 151.0746 },
    fuelOffers: [
      { fuelCode: 'U91', priceCentsPerLitre: 193.9, updatedHoursAgo: 5 },
      { fuelCode: 'P95', priceCentsPerLitre: 207.9, updatedHoursAgo: 5 },
      { fuelCode: 'P98', priceCentsPerLitre: 214.9, updatedHoursAgo: 5 },
    ],
  },
  {
    id: 'speedway-camperdown',
    brand: 'Speedway',
    name: 'Speedway Camperdown',
    address: '198 Parramatta Road, Camperdown NSW 2050',
    coordinate: { lat: -33.887, lng: 151.1741 },
    fuelOffers: [
      { fuelCode: 'U91', priceCentsPerLitre: 201.9, updatedHoursAgo: 3 },
      { fuelCode: 'P95', priceCentsPerLitre: 214.9, updatedHoursAgo: 3 },
      { fuelCode: 'P98', priceCentsPerLitre: 222.9, updatedHoursAgo: 3 },
      { fuelCode: 'E10', priceCentsPerLitre: 193.9, updatedHoursAgo: 3 },
    ],
  },
  {
    id: 'shell-alexandria',
    brand: 'Shell',
    name: 'Shell Alexandria',
    address: '93 Wyndham Street, Alexandria NSW 2015',
    coordinate: { lat: -33.9021, lng: 151.1997 },
    fuelOffers: [
      { fuelCode: 'U91', priceCentsPerLitre: 206.9, updatedHoursAgo: 1 },
      { fuelCode: 'P95', priceCentsPerLitre: 219.9, updatedHoursAgo: 1 },
      { fuelCode: 'P98', priceCentsPerLitre: 227.9, updatedHoursAgo: 1 },
    ],
  },
  {
    id: 'bp-north-sydney',
    brand: 'BP',
    name: 'BP North Sydney',
    address: '110 Pacific Highway, North Sydney NSW 2060',
    coordinate: { lat: -33.8408, lng: 151.2084 },
    fuelOffers: [
      { fuelCode: 'U91', priceCentsPerLitre: 208.9, updatedHoursAgo: 8 },
      { fuelCode: 'P95', priceCentsPerLitre: 222.9, updatedHoursAgo: 8 },
      { fuelCode: 'P98', priceCentsPerLitre: 228.9, updatedHoursAgo: 8 },
    ],
  },
]

export function createMockStations(now: Date): Station[] {
  return STATION_SEEDS.map((station) => ({
    ...station,
    fuelOffers: station.fuelOffers.map((offer) => ({
      fuelCode: offer.fuelCode,
      priceCentsPerLitre: offer.priceCentsPerLitre,
      updatedAt: new Date(now.getTime() - offer.updatedHoursAgo * 36e5).toISOString(),
    })),
  }))
}
