import { describe, expect, it } from 'vitest'

import {
  bestLoyaltyDiscount,
  computeEffectivePrice,
  LOYALTY_PROGRAMS,
} from './loyalty'
import type { PriceAdjustments } from './types'

describe('bestLoyaltyDiscount', () => {
  it('returns null when no programs are selected', () => {
    const result = bestLoyaltyDiscount('Ampol', [])
    expect(result).toBeNull()
  })

  it('returns null when brand does not match any selected program', () => {
    const result = bestLoyaltyDiscount('BP', ['woolworths-everyday-rewards'])
    expect(result).toBeNull()
  })

  it('returns the discount for a matching brand and program', () => {
    const result = bestLoyaltyDiscount('Ampol', ['woolworths-everyday-rewards'])
    expect(result).toEqual({
      discountCentsPerLitre: 4,
      programName: 'Woolworths Everyday Rewards',
    })
  })

  it('returns the highest discount when multiple programs match the same brand', () => {
    const result = bestLoyaltyDiscount('Ampol', [
      'woolworths-everyday-rewards',
      'ampol-app-fuelpay',
    ])
    expect(result).toEqual({
      discountCentsPerLitre: 6,
      programName: 'Ampol app (FuelPay)',
    })
  })

  it('matches brand names case-insensitively', () => {
    const result = bestLoyaltyDiscount('ampol', ['woolworths-everyday-rewards'])
    expect(result).toEqual({
      discountCentsPerLitre: 4,
      programName: 'Woolworths Everyday Rewards',
    })
  })

  it('matches Shell for Coles Flybuys scan', () => {
    const result = bestLoyaltyDiscount('Shell', ['coles-flybuys-scan'])
    expect(result).toEqual({
      discountCentsPerLitre: 4,
      programName: 'Coles Flybuys (scan)',
    })
  })

  it('stacks Coles Flybuys scan and grocery docket at Shell', () => {
    const result = bestLoyaltyDiscount('Shell', [
      'coles-flybuys-scan',
      'coles-grocery-docket',
    ])
    expect(result).toEqual({
      discountCentsPerLitre: 8,
      programName: 'Coles Flybuys (scan) + Coles grocery docket',
    })
  })

  it('picks the stacked group over a lower ungrouped program', () => {
    const result = bestLoyaltyDiscount('Coles Express', [
      'coles-flybuys-scan',
      'coles-grocery-docket',
    ])
    expect(result).toEqual({
      discountCentsPerLitre: 8,
      programName: 'Coles Flybuys (scan) + Coles grocery docket',
    })
  })

  it('does not stack programs without a stackGroup', () => {
    const result = bestLoyaltyDiscount('Ampol', [
      'woolworths-everyday-rewards',
      'nrma-membership',
    ])
    // Both are 4 c/L at Ampol but ungrouped — picks the first one found with highest discount
    expect(result?.discountCentsPerLitre).toBe(4)
  })
})

describe('computeEffectivePrice', () => {
  const baseAdjustments: PriceAdjustments = {
    enabled: true,
    selectedProgramIds: [],
    paymentCardType: 'visa-mastercard',
  }

  it('returns the listed price unchanged when adjustments are disabled', () => {
    const result = computeEffectivePrice(200, 'Ampol', {
      ...baseAdjustments,
      enabled: false,
      selectedProgramIds: ['woolworths-everyday-rewards'],
    })

    expect(result.effectivePriceCentsPerLitre).toBe(200)
    expect(result.discountCentsPerLitre).toBe(0)
    expect(result.surchargeCentsPerLitre).toBe(0)
    expect(result.appliedProgramName).toBeNull()
  })

  it('applies a loyalty discount to the effective price', () => {
    const result = computeEffectivePrice(200, 'Ampol', {
      ...baseAdjustments,
      selectedProgramIds: ['woolworths-everyday-rewards'],
    })

    expect(result.effectivePriceCentsPerLitre).toBe(196)
    expect(result.discountCentsPerLitre).toBe(4)
    expect(result.appliedProgramName).toBe('Woolworths Everyday Rewards')
  })

  it('adds an Amex surcharge for BP', () => {
    const result = computeEffectivePrice(200, 'BP', {
      ...baseAdjustments,
      paymentCardType: 'amex',
    })

    expect(result.surchargeCentsPerLitre).toBe(3)
    expect(result.effectivePriceCentsPerLitre).toBe(203)
  })

  it('adds no surcharge for Visa/Mastercard at BP', () => {
    const result = computeEffectivePrice(200, 'BP', {
      ...baseAdjustments,
      paymentCardType: 'visa-mastercard',
    })

    expect(result.surchargeCentsPerLitre).toBe(0)
    expect(result.effectivePriceCentsPerLitre).toBe(200)
  })

  it('combines loyalty discount and Amex surcharge', () => {
    const result = computeEffectivePrice(200, 'Shell', {
      ...baseAdjustments,
      selectedProgramIds: ['coles-flybuys-scan'],
      paymentCardType: 'amex',
    })

    expect(result.discountCentsPerLitre).toBe(4)
    expect(result.surchargeCentsPerLitre).toBe(3)
    expect(result.effectivePriceCentsPerLitre).toBe(199)
  })

  it('defaults to zero surcharge for unknown brands', () => {
    const result = computeEffectivePrice(200, 'Unknown Brand', {
      ...baseAdjustments,
      paymentCardType: 'amex',
    })

    expect(result.surchargeCentsPerLitre).toBe(0)
    expect(result.effectivePriceCentsPerLitre).toBe(200)
  })

  it('never produces a negative effective price', () => {
    const result = computeEffectivePrice(3, 'Ampol', {
      ...baseAdjustments,
      selectedProgramIds: ['ampol-app-fuelpay'],
    })

    expect(result.effectivePriceCentsPerLitre).toBe(0)
  })
})

describe('LOYALTY_PROGRAMS data integrity', () => {
  it('has unique program ids', () => {
    const ids = LOYALTY_PROGRAMS.map((program) => program.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every program has at least one applicable brand', () => {
    for (const program of LOYALTY_PROGRAMS) {
      expect(program.applicableBrands.length).toBeGreaterThan(0)
    }
  })

  it('every program has a positive discount', () => {
    for (const program of LOYALTY_PROGRAMS) {
      expect(program.discountCentsPerLitre).toBeGreaterThan(0)
    }
  })
})
