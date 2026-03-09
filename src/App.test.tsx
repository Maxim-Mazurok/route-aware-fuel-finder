import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { createMockServices } from './providers/mockServices'
import type { AppServices } from './providers/types'

const fixedNow = new Date('2026-03-09T10:00:00.000Z')

function renderApp(services?: AppServices) {
  return render(
    <MantineProvider>
      <App
        services={
          services ??
          createMockServices({
            now: () => fixedNow,
            currentLocation: {
              label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
              coordinate: { lat: -33.8731, lng: 151.2065 },
              source: 'current-location',
            },
          })
        }
      />
    </MantineProvider>,
  )
}

describe('App', () => {
  beforeEach(() => {
    if (typeof window.localStorage.clear === 'function') {
      window.localStorage.clear()
      return
    }

    Object.keys(window.localStorage).forEach((key) => {
      window.localStorage.removeItem(key)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('plans a route and renders ranked station cards', async () => {
    const user = userEvent.setup()

    renderApp()

    await user.clear(screen.getByLabelText(/destination/i))
    await user.type(
      screen.getByLabelText(/destination/i),
      'Parramatta Station, Parramatta NSW 2150',
    )
    await user.click(screen.getByRole('button', { name: /plan route/i }))

    await waitFor(() => {
      expect(screen.getAllByTestId('station-card').length).toBeGreaterThan(0)
    })

    expect(screen.getByTestId('route-map')).toBeInTheDocument()
    expect(screen.getByText(/stations on your way/i)).toBeInTheDocument()
  })

  it('can hide unreachable stations when fuel is low', async () => {
    const user = userEvent.setup()

    renderApp()

    const fuelNowField = screen.getByLabelText(/fuel now \(l\)/i)
    await user.clear(fuelNowField)
    await user.type(fuelNowField, '8')
    await user.click(
      screen.getByLabelText(/hide stations i probably cannot reach with current fuel/i),
    )

    await user.clear(screen.getByLabelText(/destination/i))
    await user.type(
      screen.getByLabelText(/destination/i),
      'Parramatta Station, Parramatta NSW 2150',
    )
    await user.click(screen.getByRole('button', { name: /plan route/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/nothing survived the current filters/i),
      ).toBeInTheDocument()
    })
  })

  it('persists the saved home address in local storage', async () => {
    const user = userEvent.setup()

    const firstRender = renderApp()

    await user.type(
      screen.getByLabelText(/home address/i),
      '22 Example Street, Petersham NSW 2049',
    )

    firstRender.unmount()

    renderApp()

    expect(screen.getByLabelText(/home address/i)).toHaveValue(
      '22 Example Street, Petersham NSW 2049',
    )

    await user.click(screen.getByRole('button', { name: /use home/i }))

    expect(screen.getByLabelText(/destination/i)).toHaveValue(
      '22 Example Street, Petersham NSW 2049',
    )
  })

  it('shows a validation error when no fuel types are selected', async () => {
    const user = userEvent.setup()

    renderApp()

    await user.click(screen.getByLabelText(/^U91$/i))
    await user.click(screen.getByLabelText(/^95$/i))
    await user.click(screen.getByLabelText(/^98$/i))
    await user.click(screen.getByRole('button', { name: /plan route/i }))

    expect(
      screen.getByText(/pick at least one allowed fuel before planning the trip/i),
    ).toBeInTheDocument()
  })

  it('supports a manual origin and alternate fill strategies', async () => {
    const user = userEvent.setup()

    renderApp()

    await user.click(
      screen.getByLabelText(/use a manual origin instead of the current location/i),
    )
    await user.type(
      screen.getByLabelText(/^origin$/i),
      'Sydney Town Hall, George Street, Sydney NSW 2000',
    )

    await user.selectOptions(screen.getAllByLabelText(/fill strategy/i)[0]!, 'budget')
    expect(screen.getByLabelText(/budget \(aud\)/i)).toBeInTheDocument()

    await user.selectOptions(
      screen.getAllByLabelText(/fill strategy/i)[0]!,
      'percentage',
    )
    expect(screen.getByLabelText(/target tank level/i)).toBeInTheDocument()
  })

  it('shows the station load error when the fuel dataset cannot be fetched', async () => {
    const failingServices = createMockServices({
      now: () => fixedNow,
      currentLocation: {
        label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
        coordinate: { lat: -33.8731, lng: 151.2065 },
        source: 'current-location',
      },
    })

    failingServices.fuelPriceProvider = {
      async listStations() {
        throw new Error('boom')
      },
    }

    renderApp(failingServices)

    await waitFor(() => {
      expect(
        screen.getByText(/could not load the current nsw fuel dataset/i),
      ).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /retry now/i })).toBeInTheDocument()
  })

  it('schedules a retry and can recover manually when the first station load fails', async () => {
    const user = userEvent.setup()
    const flakyServices = createMockServices({
      now: () => fixedNow,
      currentLocation: {
        label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
        coordinate: { lat: -33.8731, lng: 151.2065 },
        source: 'current-location',
      },
    })
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    let attempts = 0
    const liveStations = await flakyServices.fuelPriceProvider.listStations()

    flakyServices.fuelPriceProvider = {
      async listStations() {
        attempts += 1

        if (attempts === 1) {
          throw new Error('temporary startup race')
        }

        return liveStations
      },
    }

    renderApp(flakyServices)

    await waitFor(() => {
      expect(
        screen.getByText(/retrying automatically in a few seconds/i),
      ).toBeInTheDocument()
    })

    expect(setTimeoutSpy).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /retry now/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^plan route$/i })).toBeEnabled()
    })

    expect(
      screen.queryByText(/retrying automatically in a few seconds/i),
    ).not.toBeInTheDocument()
  })

  it('shows a planning error when geocoding cannot resolve the destination', async () => {
    const user = userEvent.setup()
    const failingServices = createMockServices({
      now: () => fixedNow,
      currentLocation: {
        label: 'Sydney Town Hall, George Street, Sydney NSW 2000',
        coordinate: { lat: -33.8731, lng: 151.2065 },
        source: 'current-location',
      },
    })

    failingServices.geocodingProvider = {
      async resolve() {
        return null
      },
    }

    renderApp(failingServices)

    await user.type(screen.getByLabelText(/destination/i), 'Unknown Place')
    await user.click(screen.getByRole('button', { name: /plan route/i }))

    await waitFor(() => {
      expect(screen.getByText(/could not resolve the destination yet/i)).toBeInTheDocument()
    })
  })
})
