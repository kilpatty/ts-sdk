import BN from 'bn.js'
import { SafeMath } from './safeMath'
import { RESOLUTION } from './constants'

/**
 * Rounding direction
 */
export enum Rounding {
    Up,
    Down,
}

/**
 * Multiply and divide with rounding
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
 * Multiply and shift right
 * @param x First number
 * @param y Second number
 * @param offset Number of bits to shift
 * @returns (x * y) >> offset
 */
export function mulShr(x: BN, y: BN, offset: number): BN {
    const prod = SafeMath.mul(x, y)
    return SafeMath.shr(prod, offset)
}

/**
 * Shift left and divide
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
