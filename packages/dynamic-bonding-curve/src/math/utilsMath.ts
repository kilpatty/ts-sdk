import BN from 'bn.js'
import { SafeMath } from './safeMath'
import { RESOLUTION } from '../constants'
import { Rounding } from '../types'

/**
 * Multiply and divide with rounding using BN
 * @param x First number
 * @param y Second number
 * @param denominator Denominator
 * @param rounding Rounding direction
 * @returns (x * y) / denominator
 */
export function mulDiv(x: BN, y: BN, denominator: BN, rounding: Rounding): BN {
    if (denominator.isZero()) {
        throw new Error('MulDiv: division by zero')
    }

    // For simple cases where precision loss is minimal, use BN directly
    if (denominator.eq(new BN(1)) || x.isZero() || y.isZero()) {
        return x.mul(y)
    }

    // Create U256-like calculation
    // We need to handle potential overflow when multiplying x and y
    // by using a larger representation (similar to U256 in Rust)
    const xHex = x.toString(16).padStart(32, '0')
    const yHex = y.toString(16).padStart(32, '0')

    // Split into high and low parts (simulating U256 behavior)
    const xLow = new BN(xHex.slice(16), 16)
    const xHigh = new BN(xHex.slice(0, 16), 16)
    const yLow = new BN(yHex.slice(16), 16)
    const yHigh = new BN(yHex.slice(0, 16), 16)

    // Calculate product parts
    const lowLow = xLow.mul(yLow)
    const lowHigh = xLow.mul(yHigh)
    const highLow = xHigh.mul(yLow)
    const highHigh = xHigh.mul(yHigh)

    // Combine parts with proper shifting
    const shift = new BN(2).pow(new BN(64))
    let prod = lowLow
    prod = prod.add(lowHigh.mul(shift))
    prod = prod.add(highLow.mul(shift))
    prod = prod.add(highHigh.mul(shift).mul(shift))

    if (rounding === Rounding.Up) {
        // Calculate ceiling division: (a + b - 1) / b
        const numerator = prod.add(denominator.sub(new BN(1)))
        return numerator.div(denominator)
    } else {
        return prod.div(denominator)
    }
}

/**
 * Multiply and shift right with BN
 * @param x First number
 * @param y Second number
 * @param offset Number of bits to shift
 * @returns (x * y) >> offset
 */
export function mulShr(x: BN, y: BN, offset: number): BN {
    if (offset === 0 || x.isZero() || y.isZero()) {
        return x.mul(y)
    }

    // Create product with BN
    const prod = SafeMath.mul(x, y)

    // Shift right
    return SafeMath.shr(prod, offset)
}

/**
 * Shift left and divide with BN
 * @param x First number
 * @param y Second number
 * @param offset Number of bits to shift
 * @param rounding Rounding direction
 * @returns (x << offset) / y
 */
export function shlDiv(x: BN, y: BN, offset: number, rounding: Rounding): BN {
    if (y.isZero()) {
        throw new Error('ShlDiv: division by zero')
    }

    if (offset === 0 || x.isZero()) {
        return x.div(y)
    }

    // Shift left
    const shifted = SafeMath.shl(x, offset)

    if (rounding === Rounding.Up) {
        // Calculate ceiling division: (a + b - 1) / b
        const numerator = SafeMath.add(shifted, SafeMath.sub(y, new BN(1)))
        return SafeMath.div(numerator, y)
    } else {
        return SafeMath.div(shifted, y)
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

/**
 * Safe multiplication and division for u128
 * @param x First number
 * @param y Second number
 * @param denominator Denominator
 * @returns (x * y) / denominator as u128
 */
export function safeMulDivCastU128(x: BN, y: BN, denominator: BN): BN {
    if (denominator.isZero()) {
        throw new Error('MulDiv: division by zero')
    }

    // Create U256-like calculation using BN
    const prod = SafeMath.mul(x, y)
    return SafeMath.div(prod, denominator)
}

/**
 * Safe shift left, division, and casting
 * @param x First number
 * @param y Second number
 * @param offset Number of bits to shift
 * @param rounding Rounding direction
 * @returns (x << offset) / y
 */
export function safeShlDivCast(
    x: BN,
    y: BN,
    offset: number,
    rounding: Rounding
): BN {
    return shlDiv(x, y, offset, rounding)
}

/**
 * Safe multiplication, shift right, and casting
 * @param x First number
 * @param y Second number
 * @param offset Number of bits to shift
 * @returns (x * y) >> offset
 */
export function safeMulShrCast(x: BN, y: BN, offset: number): BN {
    return mulShr(x, y, offset)
}

/**
 * Get delta bin ID
 * @param binStepU128 Bin step
 * @param sqrtPriceA First sqrt price
 * @param sqrtPriceB Second sqrt price
 * @returns Delta bin ID
 */
export function getDeltaBinId(
    binStepU128: BN,
    sqrtPriceA: BN,
    sqrtPriceB: BN
): BN {
    const [upperSqrtPrice, lowerSqrtPrice] = sqrtPriceA.gt(sqrtPriceB)
        ? [sqrtPriceA, sqrtPriceB]
        : [sqrtPriceB, sqrtPriceA]

    const priceRatio = safeShlDivCast(
        upperSqrtPrice,
        lowerSqrtPrice,
        RESOLUTION,
        Rounding.Down
    )

    const ONE_Q64_BN = new BN(1).shln(RESOLUTION)
    const deltaBinId = SafeMath.div(
        SafeMath.sub(priceRatio, ONE_Q64_BN),
        binStepU128
    )

    return SafeMath.mul(deltaBinId, new BN(2))
}
