import BN from 'bn.js'

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
