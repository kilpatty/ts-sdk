import BN from 'bn.js'
import { RESOLUTION } from '../constants'

/**
 * Safe math operations for BN
 */
export class SafeMath {
    /**
     * Safe addition
     * @param a First number
     * @param b Second number
     * @returns Sum of a and b
     */
    static add(a: BN, b: BN): BN {
        return a.add(b)
    }

    /**
     * Safe subtraction
     * @param a First number
     * @param b Second number
     * @returns Difference of a and b
     * @throws Error if b > a
     */
    static sub(a: BN, b: BN): BN {
        if (b.gt(a)) {
            throw new Error('SafeMath: subtraction overflow')
        }
        return a.sub(b)
    }

    /**
     * Safe multiplication
     * @param a First number
     * @param b Second number
     * @returns Product of a and b
     */
    static mul(a: BN, b: BN): BN {
        return a.mul(b)
    }

    /**
     * Safe division
     * @param a First number
     * @param b Second number
     * @returns Quotient of a and b
     * @throws Error if b is zero
     */
    static div(a: BN, b: BN): BN {
        if (b.isZero()) {
            throw new Error('SafeMath: division by zero')
        }
        return a.div(b)
    }

    /**
     * Safe modulo
     * @param a First number
     * @param b Second number
     * @returns Remainder of a divided by b
     * @throws Error if b is zero
     */
    static mod(a: BN, b: BN): BN {
        if (b.isZero()) {
            throw new Error('SafeMath: modulo by zero')
        }
        return a.mod(b)
    }

    /**
     * Safe left shift
     * @param a Number to shift
     * @param b Number of bits to shift
     * @returns a << b
     */
    static shl(a: BN, b: number): BN {
        return a.shln(b)
    }

    /**
     * Safe right shift
     * @param a Number to shift
     * @param b Number of bits to shift
     * @returns a >> b
     */
    static shr(a: BN, b: number): BN {
        return a.shrn(b)
    }
}

/**
 * Safe power function for BN with scaling
 * @param base Base number (scaled by RESOLUTION)
 * @param exponent Exponent (can be negative)
 * @param scaling Whether to apply RESOLUTION scaling to the result
 * @returns base^exponent
 */
export function pow(base: BN, exponent: BN, scaling: boolean = true): BN {
    const ONE = new BN(1).shln(RESOLUTION)

    // Handle special cases
    if (exponent.isZero()) return ONE
    if (base.isZero()) return new BN(0)
    if (base.eq(ONE)) return ONE

    // Handle negative exponents
    const isNegative = exponent.isNeg()
    const absExponent = isNegative ? exponent.neg() : exponent

    // Use binary exponentiation
    let result = ONE
    let currentBase = base
    let exp = absExponent

    while (!exp.isZero()) {
        if (exp.and(new BN(1)).eq(new BN(1))) {
            result = SafeMath.div(SafeMath.mul(result, currentBase), ONE)
        }
        currentBase = SafeMath.div(SafeMath.mul(currentBase, currentBase), ONE)
        exp = exp.shrn(1)
    }

    // Handle negative exponent
    if (isNegative) {
        result = SafeMath.div(ONE.mul(ONE), result)
    }

    // Apply scaling if requested
    return scaling ? result : SafeMath.div(result, ONE)
}
