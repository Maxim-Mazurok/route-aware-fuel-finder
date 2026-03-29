import { createMockServices } from './mockServices'
import { createHttpServices } from './httpServices'
import { createGoogleServices } from './googleServices'
import type { AppServices } from './types'

function resolveGoogleConfig() {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
    | string
    | undefined
  const fuelProxyUrl = import.meta.env.VITE_FUEL_PROXY_URL as
    | string
    | undefined

  if (googleApiKey && fuelProxyUrl) {
    return { googleApiKey, fuelProxyUrl }
  }

  return null
}

const googleConfig = resolveGoogleConfig()

function resolveServices(): AppServices {
  if (import.meta.env.VITE_USE_MOCK_SERVICES === '1') {
    return createMockServices()
  }

  if (googleConfig) {
    return createGoogleServices(googleConfig)
  }

  return createHttpServices()
}

export const defaultServices = resolveServices()

export const googleServicesAvailable = googleConfig !== null

export function resolveServicesByBackend(preferredBackend: 'osrm' | 'google'): AppServices {
  if (preferredBackend === 'google' && googleConfig) {
    return createGoogleServices(googleConfig)
  }

  return createHttpServices()
}
