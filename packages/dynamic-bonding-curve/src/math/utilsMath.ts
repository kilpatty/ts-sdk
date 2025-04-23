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
 * @throws If division by zero or overflow occurs
 */
export function mulDiv(x: BN, y: BN, denominator: BN, rounding: Rounding): BN {
    if (denominator.isZero()) {
        throw new Error('MulDiv: division by zero')
    }

    if (denominator.eq(new BN(1)) || x.isZero() || y.isZero()) {
        return x.mul(y)
    }

    const prod = x.mul(y)

    if (rounding === Rounding.Up) {
        // Calculate ceiling division: (prod + denominator - 1) / denominator
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

    const prod = SafeMath.mul(x, y)

    return SafeMath.shr(prod, offset)
}
