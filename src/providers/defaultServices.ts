import { createMockServices } from './mockServices'
import { createHttpServices } from './httpServices'
import { createGoogleServices } from './googleServices'

function resolveServices() {
  if (import.meta.env.VITE_USE_MOCK_SERVICES === '1') {
    return createMockServices()
  }

  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
    | string
    | undefined
  const fuelProxyUrl = import.meta.env.VITE_FUEL_PROXY_URL as
    | string
    | undefined

  if (googleApiKey && fuelProxyUrl) {
    return createGoogleServices({ googleApiKey, fuelProxyUrl })
  }

  return createHttpServices()
}

export const defaultServices = resolveServices()
