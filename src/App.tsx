import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  Grid,
  Group,
  NativeSelect,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react'
import { startTransition, useEffect, useState } from 'react'

import './App.css'
import {
  formatAgeHours,
  formatCurrency,
  formatDistance,
  formatDurationMinutes,
  formatFuelCode,
  formatFuelPrice,
} from './domain/format'
import { DEFAULT_PRICE_ADJUSTMENTS, LOYALTY_PROGRAMS } from './domain/loyalty'
import { buildRankedStations } from './domain/ranking'
import type {
  FillStrategy,
  FuelCode,
  PaymentCardType,
  PriceAdjustments,
  RankedStation,
  RoutePlan,
  SortMode,
  Station,
  StationRouteMetrics,
  VehicleProfile,
} from './domain/types'
import { KNOWN_PLACES } from './fixtures/mockData'
import { usePersistentState } from './hooks/usePersistentState'
import { StationMap } from './components/StationMap'
import { defaultServices } from './providers/defaultServices'
import type { AppServices, ResolvedPlace } from './providers/types'

const FUEL_OPTIONS: FuelCode[] = ['U91', 'E10', 'P95', 'P98', 'DL', 'PDL', 'LPG', 'EV']
const STATION_RETRY_DELAY_MS = 3000

const PRESET_TIME_VALUES = [
  { label: 'Student', value: 12 },
  { label: 'Middle class', value: 35 },
  { label: 'Billionaire', value: 220 },
]

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'pump-price', label: 'Pump price' },
  { value: 'extra-time', label: 'Extra time' },
  { value: 'extra-distance', label: 'Extra distance' },
  { value: 'freshness', label: 'Freshness' },
]

const PRICE_AGE_OPTIONS = [
  { value: '24', label: '24 hours' },
  { value: '48', label: '48 hours' },
  { value: '72', label: '72 hours' },
  { value: 'any', label: 'Any age' },
]

type PlanStatus = 'idle' | 'planning' | 'ready' | 'error'
type FillMode = 'full' | 'litres' | 'percentage' | 'budget'

interface RawPlan {
  origin: ResolvedPlace
  destination: ResolvedPlace
  route: RoutePlan
  metricsByStationId: Record<string, StationRouteMetrics>
}

interface AppProps {
  services?: AppServices
}

interface MetricTileProps {
  label: string
  value: string
}

function MetricTile({ label, value }: MetricTileProps) {
  return (
    <Paper withBorder radius="md" p="sm" className="metric-tile">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
    </Paper>
  )
}

function toNumber(value: string | number, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function deriveFillStrategy(mode: FillMode, value: number): FillStrategy {
  switch (mode) {
    case 'litres':
      return { kind: 'litres', litres: value }
    case 'percentage':
      return { kind: 'percentage', targetPercent: value }
    case 'budget':
      return { kind: 'budget', amountDollars: value }
    case 'full':
    default:
      return { kind: 'full' }
  }
}

function fillValueLabel(fillMode: FillMode) {
  switch (fillMode) {
    case 'litres':
      return 'Target fill (L)'
    case 'percentage':
      return 'Target tank level (%)'
    case 'budget':
      return 'Budget (AUD)'
    case 'full':
    default:
      return ''
  }
}

function explainStation(station: RankedStation, stations: RankedStation[]) {
  const cheapest = Math.min(
    ...stations.map((entry) => entry.chosenOffer.priceCentsPerLitre),
  )
  const quickest = Math.min(...stations.map((entry) => entry.extraDurationMinutes))
  const freshest = Math.min(...stations.map((entry) => entry.ageHours))

  if (station.chosenOffer.priceCentsPerLitre === cheapest) {
    return 'Lowest compatible pump price in the current list.'
  }

  if (station.extraDurationMinutes === quickest) {
    return 'Smallest interruption to the current route.'
  }

  if (station.ageHours === freshest) {
    return 'Most recently updated compatible price in the list.'
  }

  return 'Balanced trade-off between fill cost, detour, and time value.'
}

function App({ services = defaultServices }: AppProps) {
  const [destinationQuery, setDestinationQuery] = usePersistentState(
    'route-aware-fuel-finder:destination-query',
    '',
  )
  const [homeAddress, setHomeAddress] = usePersistentState(
    'route-aware-fuel-finder:home-address',
    '',
  )
  const [manualOriginEnabled, setManualOriginEnabled] = usePersistentState(
    'route-aware-fuel-finder:manual-origin-enabled',
    false,
  )
  const [originQuery, setOriginQuery] = usePersistentState(
    'route-aware-fuel-finder:origin-query',
    '',
  )
  const [tankCapacityLitres, setTankCapacityLitres] = usePersistentState(
    'route-aware-fuel-finder:tank-capacity',
    50,
  )
  const [currentFuelLitres, setCurrentFuelLitres] = usePersistentState(
    'route-aware-fuel-finder:current-fuel-litres',
    17,
  )
  const [consumptionLitresPer100Km, setConsumptionLitresPer100Km] =
    usePersistentState('route-aware-fuel-finder:consumption', 8.2)
  const [fillMode, setFillMode] = usePersistentState<FillMode>(
    'route-aware-fuel-finder:fill-mode',
    'full',
  )
  const [fillValue, setFillValue] = usePersistentState(
    'route-aware-fuel-finder:fill-value',
    30,
  )
  const [fuelSelections, setFuelSelections] = usePersistentState<
    Record<FuelCode, boolean>
  >('route-aware-fuel-finder:fuel-selection', {
    U91: true,
    E10: false,
    P95: true,
    P98: true,
    DL: false,
    PDL: false,
    LPG: false,
    EV: false,
  })
  const [timePresetLabel, setTimePresetLabel] = usePersistentState(
    'route-aware-fuel-finder:time-preset',
    'Middle class',
  )
  const [timeValueDollarsPerHour, setTimeValueDollarsPerHour] = usePersistentState(
    'route-aware-fuel-finder:time-value',
    35,
  )
  const [maxExtraMinutesEnabled, setMaxExtraMinutesEnabled] = usePersistentState(
    'route-aware-fuel-finder:max-extra-minutes-enabled',
    true,
  )
  const [maxExtraMinutesValue, setMaxExtraMinutesValue] = usePersistentState(
    'route-aware-fuel-finder:max-extra-minutes-value',
    11,
  )
  const [maxExtraKilometresEnabled, setMaxExtraKilometresEnabled] =
    usePersistentState('route-aware-fuel-finder:max-extra-km-enabled', true)
  const [maxExtraKilometresValue, setMaxExtraKilometresValue] = usePersistentState(
    'route-aware-fuel-finder:max-extra-km-value',
    8,
  )
  const [hideUnreachable, setHideUnreachable] = usePersistentState(
    'route-aware-fuel-finder:hide-unreachable',
    false,
  )
  const [maxPriceAgeHours, setMaxPriceAgeHours] = usePersistentState<number | null>(
    'route-aware-fuel-finder:max-price-age-hours',
    72,
  )
  const [sortMode, setSortMode] = usePersistentState<SortMode>(
    'route-aware-fuel-finder:sort-mode',
    'recommended',
  )

  const [loyaltyEnabled, setLoyaltyEnabled] = usePersistentState(
    'route-aware-fuel-finder:loyalty-enabled',
    DEFAULT_PRICE_ADJUSTMENTS.enabled,
  )
  const [selectedProgramIds, setSelectedProgramIds] = usePersistentState<string[]>(
    'route-aware-fuel-finder:selected-programs',
    DEFAULT_PRICE_ADJUSTMENTS.selectedProgramIds,
  )
  const [paymentCardType, setPaymentCardType] = usePersistentState<PaymentCardType>(
    'route-aware-fuel-finder:payment-card-type',
    DEFAULT_PRICE_ADJUSTMENTS.paymentCardType,
  )

  const [stations, setStations] = useState<Station[]>([])
  const [isStationDatasetLoading, setIsStationDatasetLoading] = useState(true)
  const [stationLoadError, setStationLoadError] = useState<string | null>(null)
  const [stationReloadVersion, setStationReloadVersion] = useState(0)
  const [planStatus, setPlanStatus] = useState<PlanStatus>('idle')
  const [planError, setPlanError] = useState<string | null>(null)
  const [rawPlan, setRawPlan] = useState<RawPlan | null>(null)

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function loadStations() {
      if (!cancelled) {
        setIsStationDatasetLoading(true)
      }

      try {
        const nextStations = await services.fuelPriceProvider.listStations()

        if (!cancelled) {
          setStations(nextStations)
          setStationLoadError(null)
          setIsStationDatasetLoading(false)
        }
      } catch {
        if (!cancelled) {
          setStationLoadError(
            'Could not load the current NSW fuel dataset. Retrying automatically in a few seconds.',
          )
          setIsStationDatasetLoading(false)
          retryTimer = setTimeout(() => {
            setStationReloadVersion((current) => current + 1)
          }, STATION_RETRY_DELAY_MS)
        }
      }
    }

    loadStations()

    return () => {
      cancelled = true
      if (retryTimer) {
        clearTimeout(retryTimer)
      }
    }
  }, [services, stationReloadVersion])

  const allowedFuelCodes = FUEL_OPTIONS.filter((fuelCode) => fuelSelections[fuelCode])
  const fillStrategy = deriveFillStrategy(fillMode, fillValue)

  const vehicle: VehicleProfile = {
    tankCapacityLitres,
    currentFuelLitres,
    consumptionLitresPer100Km,
    allowedFuelCodes,
  }

  const priceAdjustments: PriceAdjustments = {
    enabled: loyaltyEnabled,
    selectedProgramIds,
    paymentCardType,
  }

  const rankedStations =
    rawPlan && allowedFuelCodes.length > 0
      ? buildRankedStations({
          now: services.now(),
          stations,
          route: rawPlan.route,
          metricsByStationId: rawPlan.metricsByStationId,
          vehicle,
          fillStrategy,
          preferences: {
            timeValueDollarsPerHour,
            maxExtraMinutes: maxExtraMinutesEnabled ? maxExtraMinutesValue : null,
            maxExtraKilometres: maxExtraKilometresEnabled
              ? maxExtraKilometresValue
              : null,
            hideUnreachable,
            maxPriceAgeHours,
            sortMode,
          },
          priceAdjustments,
        })
      : []

  async function resolvePlace(query: string, label: 'origin' | 'destination') {
    const result = await services.geocodingProvider.resolve(query)

    if (!result) {
      throw new Error(
        `Could not resolve the ${label} yet. Try a fuller address or one of the quick picks.`,
      )
    }

    return result
  }

  async function handlePlanRoute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (allowedFuelCodes.length === 0) {
      setPlanStatus('error')
      setPlanError('Pick at least one allowed fuel before planning the trip.')
      return
    }

    setPlanStatus('planning')
    setPlanError(null)

    try {
      const [origin, destination] = await Promise.all([
        manualOriginEnabled
          ? resolvePlace(originQuery, 'origin')
          : services.currentLocationProvider.getCurrentLocation(),
        resolvePlace(destinationQuery, 'destination'),
      ])

      const route = await services.routeProvider.planRoute(
        origin.coordinate,
        destination.coordinate,
      )
      const metricsByStationId = await services.routeProvider.measureStationDetours(
        route,
        stations,
      )

      startTransition(() => {
        setRawPlan({
          origin,
          destination,
          route,
          metricsByStationId,
        })
        setPlanStatus('ready')
      })
    } catch (error) {
      setPlanStatus('error')
      setPlanError(
        error instanceof Error ? error.message : 'Route planning failed unexpectedly.',
      )
    }
  }

  return (
    <Container size="xl" className="app-shell">
      <Paper withBorder shadow="sm" radius="xl" p={{ base: 'lg', sm: 'xl' }}>
        <Stack gap="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts="0.08em">
            Route-Aware Fuel Finder
          </Text>
          <Title order={1} size="h2" className="page-title">
            Plan a sensible fuel stop on the way.
          </Title>
          <Text c="dimmed" maw={760}>
            Compare live NSW fuel prices against detour time, distance, price age, and
            the value of your own time. Settings stay in local storage, so the app
            opens the way you left it.
          </Text>
        </Stack>
      </Paper>

      <Grid gutter="lg" align="start" mt="lg">
        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper withBorder shadow="sm" radius="xl" p="lg">
            <form onSubmit={handlePlanRoute}>
              <Stack gap="lg">
                <Stack gap="md">
                  <Box>
                    <Title order={2} size="h3">
                      Trip setup
                    </Title>
                    <Text size="sm" c="dimmed">
                      Destination, saved home address, and optional manual origin.
                    </Text>
                  </Box>

                  <TextInput
                    label="Destination"
                    placeholder="Parramatta Station, Parramatta NSW 2150"
                    value={destinationQuery}
                    onChange={(event) => setDestinationQuery(event.currentTarget.value)}
                  />

                  <TextInput
                    label="Home address"
                    placeholder="Your usual destination"
                    description="Saved locally. Use a full address or a place name."
                    value={homeAddress}
                    onChange={(event) => setHomeAddress(event.currentTarget.value)}
                  />

                  <Group gap="sm">
                    <Button
                      type="button"
                      variant="light"
                      onClick={() => setDestinationQuery(homeAddress)}
                      disabled={!homeAddress.trim()}
                    >
                      Use home
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => setHomeAddress(destinationQuery)}
                      disabled={!destinationQuery.trim()}
                    >
                      Set home from destination
                    </Button>
                  </Group>

                  <Group gap="xs">
                    {KNOWN_PLACES.slice(0, 4).map((place) => (
                      <Button
                        key={place.label}
                        type="button"
                        variant="default"
                        size="xs"
                        onClick={() => setDestinationQuery(place.label)}
                      >
                        {place.label.split(',')[0]}
                      </Button>
                    ))}
                  </Group>

                  <Switch
                    checked={manualOriginEnabled}
                    onChange={(event) =>
                      setManualOriginEnabled(event.currentTarget.checked)
                    }
                    label="Use a manual origin instead of the current location"
                  />

                  {manualOriginEnabled ? (
                    <TextInput
                      label="Origin"
                      placeholder="Sydney Town Hall, George Street, Sydney NSW 2000"
                      value={originQuery}
                      onChange={(event) => setOriginQuery(event.currentTarget.value)}
                    />
                  ) : (
                    <Text size="sm" c="dimmed">
                      The app uses your current location by default every time.
                    </Text>
                  )}
                </Stack>

                <Divider />

                <Stack gap="md">
                  <Box>
                    <Title order={2} size="h3">
                      Vehicle and fill
                    </Title>
                    <Text size="sm" c="dimmed">
                      Keep the inputs practical: litres in the tank, tank size, and
                      consumption in litres per 100 km.
                    </Text>
                  </Box>

                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <NumberInput
                      label="Tank size (L)"
                      value={tankCapacityLitres}
                      onChange={(value) => setTankCapacityLitres(toNumber(value))}
                      min={0}
                      hideControls
                      decimalScale={1}
                    />
                    <NumberInput
                      label="Fuel now (L)"
                      value={currentFuelLitres}
                      onChange={(value) => setCurrentFuelLitres(toNumber(value))}
                      min={0}
                      hideControls
                      decimalScale={1}
                    />
                    <NumberInput
                      label="Consumption (L/100 km)"
                      value={consumptionLitresPer100Km}
                      onChange={(value) =>
                        setConsumptionLitresPer100Km(toNumber(value))
                      }
                      min={0}
                      hideControls
                      decimalScale={1}
                    />
                  </SimpleGrid>

                  <Box>
                    <Text size="sm" fw={600} mb={8}>
                      Fill strategy
                    </Text>
                    <NativeSelect
                      label="Fill strategy"
                      data={[
                        { value: 'full', label: 'Full tank' },
                        { value: 'litres', label: 'Litres' },
                        { value: 'percentage', label: 'Target %' },
                        { value: 'budget', label: 'Budget' },
                      ]}
                      value={fillMode}
                      onChange={(event) => {
                        setFillMode(event.currentTarget.value as FillMode)
                      }}
                    />
                  </Box>

                  {fillMode !== 'full' ? (
                    <NumberInput
                      label={fillValueLabel(fillMode)}
                      value={fillValue}
                      onChange={(value) => setFillValue(toNumber(value))}
                      min={0}
                      max={fillMode === 'percentage' ? 100 : undefined}
                      hideControls
                      decimalScale={fillMode === 'budget' ? 2 : 1}
                    />
                  ) : null}
                </Stack>

                <Divider />

                <Stack gap="md">
                  <Box>
                    <Title order={2} size="h3">
                      Allowed fuels
                    </Title>
                    <Text size="sm" c="dimmed">
                      Toggle only the grades you are willing to buy on this trip.
                    </Text>
                  </Box>

                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" className="fuel-grid">
                    {FUEL_OPTIONS.map((fuelCode) => (
                      <Checkbox
                        key={fuelCode}
                        label={formatFuelCode(fuelCode)}
                        checked={fuelSelections[fuelCode]}
                        onChange={(event) =>
                          setFuelSelections({
                            ...fuelSelections,
                            [fuelCode]: event.currentTarget.checked,
                          })
                        }
                      />
                    ))}
                  </SimpleGrid>
                </Stack>

                <Divider />

                <Stack gap="md">
                  <Box>
                    <Title order={2} size="h3">
                      Ranking preferences
                    </Title>
                    <Text size="sm" c="dimmed">
                      Tune the balance between savings and interruption. Nothing here is
                      hidden behind a smart mode.
                    </Text>
                  </Box>

                  <Group gap="sm">
                    {PRESET_TIME_VALUES.map((preset) => (
                      <Button
                        key={preset.label}
                        type="button"
                        variant={
                          timePresetLabel === preset.label ? 'filled' : 'default'
                        }
                        onClick={() => {
                          setTimePresetLabel(preset.label)
                          setTimeValueDollarsPerHour(preset.value)
                        }}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </Group>

                  <NumberInput
                    label="Value of time (AUD/hour)"
                    description="Used directly in the ranking score."
                    value={timeValueDollarsPerHour}
                    onChange={(value) => {
                      setTimePresetLabel('Custom')
                      setTimeValueDollarsPerHour(toNumber(value))
                    }}
                    min={0}
                    hideControls
                    decimalScale={2}
                  />

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Group justify="space-between" align="center">
                        <Text fw={600} size="sm">
                          Max extra minutes
                        </Text>
                        <Switch
                          checked={maxExtraMinutesEnabled}
                          onChange={(event) =>
                            setMaxExtraMinutesEnabled(event.currentTarget.checked)
                          }
                          label={maxExtraMinutesEnabled ? 'On' : 'Off'}
                          labelPosition="left"
                        />
                      </Group>
                      <NumberInput
                        label="Limit (minutes)"
                        value={maxExtraMinutesValue}
                        onChange={(value) => setMaxExtraMinutesValue(toNumber(value))}
                        min={0}
                        hideControls
                        disabled={!maxExtraMinutesEnabled}
                      />
                    </Stack>

                    <Stack gap="xs">
                      <Group justify="space-between" align="center">
                        <Text fw={600} size="sm">
                          Max extra distance
                        </Text>
                        <Switch
                          checked={maxExtraKilometresEnabled}
                          onChange={(event) =>
                            setMaxExtraKilometresEnabled(event.currentTarget.checked)
                          }
                          label={maxExtraKilometresEnabled ? 'On' : 'Off'}
                          labelPosition="left"
                        />
                      </Group>
                      <NumberInput
                        label="Limit (km)"
                        value={maxExtraKilometresValue}
                        onChange={(value) =>
                          setMaxExtraKilometresValue(toNumber(value))
                        }
                        min={0}
                        hideControls
                        decimalScale={1}
                        disabled={!maxExtraKilometresEnabled}
                      />
                    </Stack>
                  </SimpleGrid>

                  <NativeSelect
                    label="Price age filter"
                    value={maxPriceAgeHours === null ? 'any' : String(maxPriceAgeHours)}
                    data={PRICE_AGE_OPTIONS}
                    onChange={(event) =>
                      setMaxPriceAgeHours(
                        event.currentTarget.value === 'any'
                          ? null
                          : Number(event.currentTarget.value),
                      )
                    }
                  />

                  <Checkbox
                    checked={hideUnreachable}
                    onChange={(event) =>
                      setHideUnreachable(event.currentTarget.checked)
                    }
                    label="Hide stations I probably cannot reach with current fuel"
                  />
                </Stack>

                <Divider />

                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Box>
                      <Title order={2} size="h3">
                        Discounts and loyalty
                      </Title>
                      <Text size="sm" c="dimmed">
                        Select programs you use. The effective price factors in
                        discounts and card surcharges.
                      </Text>
                    </Box>
                    <Switch
                      checked={loyaltyEnabled}
                      onChange={(event) =>
                        setLoyaltyEnabled(event.currentTarget.checked)
                      }
                      label={loyaltyEnabled ? 'On' : 'Off'}
                      labelPosition="left"
                    />
                  </Group>

                  <NativeSelect
                    label="Payment card type"
                    description="Affects surcharges at some stations."
                    value={paymentCardType}
                    data={[
                      { value: 'visa-mastercard', label: 'Visa / Mastercard' },
                      { value: 'amex', label: 'American Express' },
                    ]}
                    onChange={(event) =>
                      setPaymentCardType(
                        event.currentTarget.value as PaymentCardType,
                      )
                    }
                    disabled={!loyaltyEnabled}
                  />

                  <Stack gap="xs">
                    {LOYALTY_PROGRAMS.map((program) => {
                      const isSelected = selectedProgramIds.includes(program.id)
                      const prerequisiteColor =
                        program.prerequisite === 'free-app'
                          ? 'green'
                          : program.prerequisite === 'supermarket-spend'
                            ? 'blue'
                            : 'orange'
                      const prerequisiteLabel =
                        program.prerequisite === 'free-app'
                          ? 'Free app'
                          : program.prerequisite === 'supermarket-spend'
                            ? 'Supermarket spend'
                            : 'Paid membership'

                      return (
                        <Paper
                          key={program.id}
                          withBorder
                          radius="md"
                          p="sm"
                          className={
                            isSelected && loyaltyEnabled
                              ? 'loyalty-program-selected'
                              : ''
                          }
                        >
                          <Group gap="sm" wrap="nowrap" align="flex-start">
                            <Checkbox
                              checked={isSelected}
                              onChange={(event) => {
                                if (event.currentTarget.checked) {
                                  setSelectedProgramIds([
                                    ...selectedProgramIds,
                                    program.id,
                                  ])
                                } else {
                                  setSelectedProgramIds(
                                    selectedProgramIds.filter(
                                      (existingId) => existingId !== program.id,
                                    ),
                                  )
                                }
                              }}
                              disabled={!loyaltyEnabled}
                              mt={4}
                            />
                            <Box
                              className="loyalty-brand-avatar"
                              style={{
                                backgroundColor: program.brandColor,
                              }}
                            >
                              <Text size="xs" fw={700} c="white" lh={1}>
                                {program.shortName}
                              </Text>
                            </Box>
                            <Stack gap={4} style={{ flex: 1 }}>
                              <Group gap="xs" wrap="wrap">
                                <Text fw={600} size="sm">
                                  {program.name}
                                </Text>
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color={prerequisiteColor}
                                >
                                  {prerequisiteLabel}
                                </Badge>
                                <Badge size="xs" variant="outline">
                                  −{program.discountCentsPerLitre} c/L
                                </Badge>
                              </Group>
                              <Text size="xs" c="dimmed">
                                {program.description}
                              </Text>
                              <Text size="xs" c="dimmed" fs="italic">
                                {program.prerequisiteNote}
                              </Text>
                              <Group gap={4}>
                                {program.applicableBrands.map((brand) => (
                                  <Badge
                                    key={brand}
                                    size="xs"
                                    variant="dot"
                                    color="gray"
                                  >
                                    {brand}
                                  </Badge>
                                ))}
                              </Group>
                            </Stack>
                          </Group>
                        </Paper>
                      )
                    })}
                  </Stack>
                </Stack>

                <Button
                  type="submit"
                  loading={planStatus === 'planning'}
                  disabled={stations.length === 0 || isStationDatasetLoading}
                >
                  {isStationDatasetLoading && stations.length === 0
                    ? 'Loading fuel data...'
                    : 'Plan route'}
                </Button>

                <Text size="sm" c="dimmed">
                  Fuel data comes from the live NSW feed. All settings are stored
                  locally in your browser.
                </Text>
              </Stack>
            </form>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper withBorder shadow="sm" radius="xl" p="lg">
            <Stack gap="lg">
              <Group justify="space-between" align="end">
                <Box>
                  <Title order={2} size="h3">
                    Stations on your way
                  </Title>
                  <Text size="sm" c="dimmed">
                    Ranked list with map context. Sort it if you want, but the default
                    order already uses your current preferences.
                  </Text>
                </Box>

                <Box maw={220} miw={180}>
                  <NativeSelect
                    label="Sort by"
                    aria-label="Sort stations"
                    value={sortMode}
                    data={SORT_OPTIONS}
                    onChange={(event) => {
                      setSortMode(event.currentTarget.value as SortMode)
                    }}
                  />
                </Box>
              </Group>

              {stationLoadError ? (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                  <Group justify="space-between" align="center" gap="sm">
                    <Text size="sm">{stationLoadError}</Text>
                    <Button
                      type="button"
                      variant="white"
                      color="red"
                      onClick={() =>
                        setStationReloadVersion((current) => current + 1)
                      }
                    >
                      Retry now
                    </Button>
                  </Group>
                </Alert>
              ) : null}

              {planError ? (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                  {planError}
                </Alert>
              ) : null}

              {rawPlan ? (
                <>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <MetricTile label="Origin" value={rawPlan.origin.label} />
                    <MetricTile label="Destination" value={rawPlan.destination.label} />
                    <MetricTile
                      label="Base route"
                      value={`${formatDistance(rawPlan.route.distanceKm)} · ${formatDurationMinutes(
                        rawPlan.route.durationMinutes,
                      )}`}
                    />
                  </SimpleGrid>

                  <Box className="map-wrapper">
                    <StationMap route={rawPlan.route} stations={rankedStations} />
                  </Box>
                </>
              ) : (
                <Alert
                  variant="light"
                  color="blue"
                  icon={<IconInfoCircle size={16} />}
                >
                  Enter a destination and plan the route. If routing or geocoding is
                  unavailable, the page will report which upstream is missing.
                </Alert>
              )}

              {planStatus === 'ready' && rankedStations.length === 0 ? (
                <Alert
                  variant="light"
                  color="yellow"
                  icon={<IconInfoCircle size={16} />}
                >
                  Nothing survived the current filters. Disable a detour cap, widen the
                  price age filter, or allow another compatible fuel grade.
                </Alert>
              ) : null}

              <Stack gap="md" aria-live="polite">
                {rankedStations.map((station, index) => (
                  <Card
                    key={station.station.id}
                    withBorder
                    radius="lg"
                    padding="lg"
                    data-testid="station-card"
                  >
                    <Stack gap="md">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={4} className="station-copy">
                          <Group gap="xs">
                            <Badge variant="light">#{index + 1}</Badge>
                            <Title order={3} size="h4">
                              {station.station.name}
                            </Title>
                          </Group>
                          <Text size="sm" c="dimmed" className="station-address">
                            {station.station.address}
                          </Text>
                        </Stack>

                        <Stack gap={4} align="flex-end">
                          <Text fw={800} size="xl">
                            {formatFuelPrice(station.effectivePriceCentsPerLitre)}
                          </Text>
                          {station.discountCentsPerLitre > 0 ? (
                            <Text size="xs" c="dimmed" td="line-through">
                              {formatFuelPrice(
                                station.chosenOffer.priceCentsPerLitre,
                              )}
                            </Text>
                          ) : null}
                          <Badge variant="default">
                            {formatFuelCode(station.chosenOffer.fuelCode)}
                          </Badge>
                        </Stack>
                      </Group>

                      <Text size="sm" c="dimmed">
                        {explainStation(station, rankedStations)}
                      </Text>

                      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                        <MetricTile
                          label="Fill cost"
                          value={formatCurrency(station.fillCostDollars)}
                        />
                        <MetricTile
                          label="Effective stop cost"
                          value={formatCurrency(station.effectiveStopCostDollars)}
                        />
                        <MetricTile
                          label="Extra time"
                          value={formatDurationMinutes(station.extraDurationMinutes)}
                        />
                        <MetricTile
                          label="Extra distance"
                          value={formatDistance(station.extraDistanceKm)}
                        />
                        <MetricTile
                          label="Fill amount"
                          value={`${station.fillLitres.toFixed(1)} L`}
                        />
                        <MetricTile
                          label="Price updated"
                          value={formatAgeHours(station.ageHours)}
                        />
                      </SimpleGrid>

                      <Group gap="xs">
                        <Badge color={station.reachable ? 'green' : 'yellow'} variant="light">
                          {station.reachable ? 'Reachable now' : 'Potential stretch'}
                        </Badge>
                        <Badge variant="light" color="gray">
                          Detour fuel {formatCurrency(station.detourFuelCostDollars)}
                        </Badge>
                        <Badge variant="light" color="gray">
                          Time penalty {formatCurrency(station.timePenaltyDollars)}
                        </Badge>
                        {station.appliedProgramName ? (
                          <Tooltip label={station.appliedProgramName}>
                            <Badge variant="light" color="teal">
                              Loyalty −{station.discountCentsPerLitre.toFixed(1)} c/L
                            </Badge>
                          </Tooltip>
                        ) : null}
                        {station.surchargeCentsPerLitre > 0 ? (
                          <Badge variant="light" color="red">
                            Surcharge +{station.surchargeCentsPerLitre.toFixed(1)} c/L
                          </Badge>
                        ) : null}
                        {station.discountCentsPerLitre > 0 ? (
                          <Badge variant="light" color="teal">
                            Save{' '}
                            {formatCurrency(
                              (station.fillLitres *
                                station.discountCentsPerLitre) /
                                100,
                            )}{' '}
                            on fill
                          </Badge>
                        ) : null}
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  )
}

export default App
