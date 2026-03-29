import type {
  CardSurchargeEntry,
  LoyaltyProgram,
  PaymentCardType,
  PriceAdjustments,
} from './types'

export const LOYALTY_PROGRAMS: LoyaltyProgram[] = [
  {
    id: 'woolworths-everyday-rewards',
    name: 'Woolworths Everyday Rewards',
    shortName: 'WW',
    description:
      'Save 4 c/L when you spend $30 or more at Woolworths and scan your Everyday Rewards card at participating stations.',
    prerequisite: 'supermarket-spend',
    prerequisiteNote: 'Requires $30+ spend at Woolworths to earn the fuel voucher.',
    discountCentsPerLitre: 4,
    applicableBrands: ['Ampol', 'EG Ampol'],
    brandColor: '#1a8b39',
  },
  {
    id: 'coles-flybuys-scan',
    name: 'Coles Flybuys (scan)',
    shortName: 'CF',
    description:
      'Save 4 c/L when you scan your Flybuys card at participating Shell and Coles Express stations. No spend required — just scan at the bowser.',
    prerequisite: 'free-app',
    prerequisiteNote: 'Free — just scan your Flybuys card at the pump.',
    discountCentsPerLitre: 4,
    applicableBrands: ['Shell', 'Coles Express'],
    brandColor: '#e01a22',
    stackGroup: 'coles',
  },
  {
    id: 'coles-grocery-docket',
    name: 'Coles grocery docket',
    shortName: 'CD',
    description:
      'Save an additional 4 c/L when you spend $30 or more at Coles and redeem the grocery docket at Shell or Coles Express. Stacks with Flybuys scan discount.',
    prerequisite: 'supermarket-spend',
    prerequisiteNote:
      'Requires $30+ spend at Coles. Stacks with Flybuys scan discount for up to 8 c/L off.',
    discountCentsPerLitre: 4,
    applicableBrands: ['Shell', 'Coles Express'],
    brandColor: '#e01a22',
    stackGroup: 'coles',
  },
  {
    id: 'ampol-app-fuelpay',
    name: 'Ampol app (FuelPay)',
    shortName: 'AP',
    description:
      'Save 6 c/L on your first 3 fills when you pay via FuelPay in the Ampol app. Free to install and sign up.',
    prerequisite: 'free-app',
    prerequisiteNote:
      'Free app — just install and create an account. Introductory offer for the first 3 fills only.',
    discountCentsPerLitre: 6,
    applicableBrands: ['Ampol'],
    brandColor: '#f58220',
  },
  {
    id: 'nrma-membership',
    name: 'NRMA Membership',
    shortName: 'NR',
    description:
      'Save 4 c/L on regular fuel and up to 5 c/L on premium fuels at participating Ampol stations via the NRMA app.',
    prerequisite: 'paid-membership',
    prerequisiteNote:
      'Requires a paid NRMA membership (roadside assistance). Stacking with supermarket vouchers has not been confirmed.',
    discountCentsPerLitre: 4,
    applicableBrands: ['Ampol'],
    brandColor: '#003478',
  },
]

/**
 * Card surcharge rates per fuel station brand.
 * Sources: surchargetracker.net (verified May 2025),
 * Payless Fuel verified via personal transaction (March 2026).
 *
 * Most major chains charge 0% on Visa/Mastercard.
 * Amex surcharges range from 0% to 1.5%.
 * Independent/unknown brands default to 0%.
 */
export const CARD_SURCHARGES: CardSurchargeEntry[] = [
  { brand: '7-Eleven', visaMastercardPercent: 0, amexPercent: 0 },
  { brand: 'Ampol', visaMastercardPercent: 0, amexPercent: 0 },
  { brand: 'BP', visaMastercardPercent: 0, amexPercent: 1.5 },
  { brand: 'Caltex', visaMastercardPercent: 0, amexPercent: 1.5 },
  { brand: 'Coles Express', visaMastercardPercent: 0, amexPercent: 1 },
  { brand: 'Payless Fuel', visaMastercardPercent: 0, amexPercent: 0 },
  { brand: 'Shell', visaMastercardPercent: 0, amexPercent: 1.5 },
]

const DEFAULT_SURCHARGE: CardSurchargeEntry = {
  brand: '',
  visaMastercardPercent: 0,
  amexPercent: 0,
}

function findSurcharge(brand: string): CardSurchargeEntry {
  return (
    CARD_SURCHARGES.find(
      (entry) => entry.brand.toLowerCase() === brand.toLowerCase(),
    ) ?? DEFAULT_SURCHARGE
  )
}

function surchargePercent(
  surcharge: CardSurchargeEntry,
  cardType: PaymentCardType,
): number {
  return cardType === 'amex'
    ? surcharge.amexPercent
    : surcharge.visaMastercardPercent
}

/**
 * Returns the best applicable discount in c/L for a station brand,
 * given the user's selected loyalty programs.
 *
 * Programs sharing the same stackGroup have their discounts summed.
 * Ungrouped programs compete individually. The highest total wins.
 */
export function bestLoyaltyDiscount(
  brand: string,
  selectedProgramIds: string[],
): { discountCentsPerLitre: number; programName: string } | null {
  const matchingPrograms = LOYALTY_PROGRAMS.filter(
    (program) =>
      selectedProgramIds.includes(program.id) &&
      program.applicableBrands.some(
        (applicableBrand) =>
          applicableBrand.toLowerCase() === brand.toLowerCase(),
      ),
  )

  if (matchingPrograms.length === 0) {
    return null
  }

  const groupTotals = new Map<
    string,
    { discount: number; names: string[] }
  >()

  for (const program of matchingPrograms) {
    const key = program.stackGroup ?? `__solo__${program.id}`
    const existing = groupTotals.get(key) ?? { discount: 0, names: [] }
    existing.discount += program.discountCentsPerLitre
    existing.names.push(program.name)
    groupTotals.set(key, existing)
  }

  let bestDiscount = 0
  let bestName = ''

  for (const group of groupTotals.values()) {
    if (group.discount > bestDiscount) {
      bestDiscount = group.discount
      bestName = group.names.join(' + ')
    }
  }

  if (bestDiscount <= 0) {
    return null
  }

  return { discountCentsPerLitre: bestDiscount, programName: bestName }
}

/**
 * Computes the effective price at a station after loyalty discounts and card surcharges.
 *
 * effectivePrice = listedPrice - loyaltyDiscount + cardSurcharge
 */
export function computeEffectivePrice(
  priceCentsPerLitre: number,
  brand: string,
  adjustments: PriceAdjustments,
): {
  effectivePriceCentsPerLitre: number
  discountCentsPerLitre: number
  surchargeCentsPerLitre: number
  appliedProgramName: string | null
} {
  if (!adjustments.enabled) {
    return {
      effectivePriceCentsPerLitre: priceCentsPerLitre,
      discountCentsPerLitre: 0,
      surchargeCentsPerLitre: 0,
      appliedProgramName: null,
    }
  }

  const loyaltyResult = bestLoyaltyDiscount(brand, adjustments.selectedProgramIds)
  const discountCentsPerLitre = loyaltyResult?.discountCentsPerLitre ?? 0
  const appliedProgramName = loyaltyResult?.programName ?? null

  const surchargeEntry = findSurcharge(brand)
  const percent = surchargePercent(surchargeEntry, adjustments.paymentCardType)
  const surchargeCentsPerLitre = (priceCentsPerLitre * percent) / 100

  const effectivePriceCentsPerLitre = Math.max(
    0,
    priceCentsPerLitre - discountCentsPerLitre + surchargeCentsPerLitre,
  )

  return {
    effectivePriceCentsPerLitre,
    discountCentsPerLitre,
    surchargeCentsPerLitre,
    appliedProgramName,
  }
}

export const DEFAULT_PRICE_ADJUSTMENTS: PriceAdjustments = {
  enabled: true,
  selectedProgramIds: [],
  paymentCardType: 'visa-mastercard',
}
