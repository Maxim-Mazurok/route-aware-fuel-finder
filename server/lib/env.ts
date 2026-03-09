function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  osrmBaseUrl: required('OSRM_BASE_URL', 'http://127.0.0.1:5300'),
  nominatimBaseUrl: required('NOMINATIM_BASE_URL', 'http://127.0.0.1:8080'),
  nominatimFallbackBaseUrl:
    process.env.NOMINATIM_FALLBACK_BASE_URL ??
    'https://nominatim.openstreetmap.org',
  nominatimUserAgent: required(
    'NOMINATIM_USER_AGENT',
    'route-aware-fuel-finder/0.1 (local development)',
  ),
  fuelApiBaseUrl: required('FUEL_API_BASE_URL', 'https://api.onegov.nsw.gov.au'),
  fuelApiKey: required('FUEL_API_KEY'),
  fuelApiSecret: required('FUEL_API_SECRET'),
}
