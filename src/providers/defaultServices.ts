import { createMockServices } from './mockServices'
import { createHttpServices } from './httpServices'

export const defaultServices =
  import.meta.env.VITE_USE_MOCK_SERVICES === '1'
    ? createMockServices()
    : createHttpServices()
