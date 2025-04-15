import BN from 'bn.js'
import Decimal from 'decimal.js'
import { SafeMath } from './safeMath'
import { Rounding } from '../types'

// Configure Decimal.js for high precision
Decimal.set({ precision: 64, rounding: Decimal.ROUND_DOWN })

/**
 * Convert BN to Decimal
 * @param bn BN value
 * @returns Decimal value
 */
export function bnToDecimal(bn: BN): Decimal {
    return new Decimal(bn.toString())
}

/**
 * Convert multiple BN values to Decimal
 * @param values BN values
 * @returns Decimal values
 */
export function batchBnToDecimal(...values: BN[]): Decimal[] {
    return values.map((bn) => new Decimal(bn.toString()))
}

/**
 * Convert Decimal to BN
 * @param decimal Decimal value
 * @param round Rounding direction
 * @returns BN value
 */
export function decimalToBN(
    decimal: Decimal,
    round: Rounding = Rounding.Down
): BN {
    if (round === Rounding.Up) {
        return new BN(decimal.ceil().toString())
    } else {
        return new BN(decimal.floor().toString())
    }
}

/**
 * Multiply and divide with rounding using Decimal.js for higher precision
 * @param x First number
 * @param y Second number
 * @param denominator Denominator
 * @param rounding Rounding direction
 * @returns (x * y) / denominator
 */
export function mulDiv(x: BN, y: BN, denominator: BN, rounding: Rounding): BN {
    // For simple cases where precision loss is minimal, use BN directly
    if (denominator.eq(new BN(1)) || x.isZero() || y.isZero()) {
        return x.mul(y)
    }

    // For small numbers where BN math is sufficient, use BN directly
    if (
        x.lt(new BN(1000)) &&
        y.lt(new BN(1000)) &&
        denominator.lt(new BN(1000))
    ) {
        return mulDivBN(x, y, denominator, rounding)
    }

    if (denominator.isZero()) {
        throw new Error('MulDiv: division by zero')
    }

    // Convert to Decimal for higher precision in one batch
    const [xDecimal, yDecimal, denominatorDecimal] = batchBnToDecimal(
        x,
        y,
        denominator
    )

    // Batch operations in Decimal
    if (!xDecimal || !yDecimal || !denominatorDecimal) {
        throw new Error('MulDiv: conversion to Decimal failed')
    }
    const result = xDecimal.mul(yDecimal).div(denominatorDecimal)

    // Apply rounding and convert back to BN
    return decimalToBN(
        rounding === Rounding.Up ? result.ceil() : result.floor(),
        rounding
    )
}

/**
 * BN-based mulDiv implementation for simpler cases
 */
export function mulDivBN(
    x: BN,
    y: BN,
    denominator: BN,
    rounding: Rounding
): BN {
    if (denominator.isZero()) {
        throw new Error('MulDiv: division by zero')
    }

    const prod = SafeMath.mul(x, y)

    if (rounding === Rounding.Up) {
        // Calculate ceiling division: (a + b - 1) / b
        const numerator = SafeMath.add(
            prod,
            SafeMath.sub(denominator, new BN(1))
        )
        return SafeMath.div(numerator, denominator)
    } else {
        return SafeMath.div(prod, denominator)
    }
}

/**
 * Safe multiplication, division, and casting to u64
 * @param x First number
 * @param y Second number
 * @param denominator Denominator
 * @param rounding Rounding direction
 * @returns (x * y) / denominator as u64
 */
export function safeMulDivCastU64(
    x: BN,
    y: BN,
    denominator: BN,
    rounding: Rounding
): BN {
    return mulDiv(x, y, denominator, rounding)
}
