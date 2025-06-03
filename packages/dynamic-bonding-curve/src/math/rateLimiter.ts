import BN from 'bn.js'
import { mulDiv } from './utilsMath'
import {
    BASIS_POINT_MAX,
    FEE_DENOMINATOR,
    MAX_FEE_NUMERATOR,
} from '../constants'
import { Rounding } from '../types'

/**
 * Calculate the fee numerator on rate limiter
 * @param cliffFeeNumerator - The cliff fee numerator
 * @param referenceAmount - The reference amount
 * @param feeIncrementBps - The fee increment bps
 * @param inputAmount - The input amount
 * @returns The fee numerator
 */
export function getFeeNumeratorOnRateLimiter(
    cliffFeeNumerator: BN,
    referenceAmount: BN,
    feeIncrementBps: BN,
    inputAmount: BN
): BN {
    // if input amount is less than or equal to reference amount, return cliff fee
    if (inputAmount.lte(referenceAmount)) {
        return cliffFeeNumerator
    }

    // calculate fee increment numerator
    const i = mulDiv(
        new BN(feeIncrementBps),
        new BN(FEE_DENOMINATOR),
        new BN(BASIS_POINT_MAX),
        Rounding.Down
    )

    // calculate max index (how many increments until we reach MAX_FEE_NUMERATOR)
    const deltaNumerator = new BN(MAX_FEE_NUMERATOR).sub(cliffFeeNumerator)
    const maxIndex = deltaNumerator.div(i)

    // calculate a and b
    // a = (input_amount - reference_amount) / reference_amount (integer division)
    // b = (input_amount - reference_amount) % reference_amount (remainder)
    const diff = inputAmount.sub(referenceAmount)
    const a = diff.div(referenceAmount)
    const b = diff.mod(referenceAmount)

    // calculate fee numerator
    let tradingFee: BN
    if (a.lt(maxIndex)) {
        // if a < max_index
        // calculate fee using the formula:
        // fee = x0 * (c + c*a + i*a*(a+1)/2) + b * (c + i*(a+1))
        // where:
        // x0 = reference_amount
        // c = cliff_fee_numerator
        // i = fee_increment_numerator
        // a = (input_amount - x0) / x0 (integer division)
        // b = (input_amount - x0) % x0 (remainder)

        const one = new BN(1)
        const two = new BN(2)
        const c = cliffFeeNumerator
        const x0 = referenceAmount

        // c + c*a
        const term1 = c.add(c.mul(a))

        // i*a*(a+1)/2
        const term2 = i.mul(a).mul(a.add(one)).div(two)

        // c + i*(a+1)
        const term3 = c.add(i.mul(a.add(one)))

        // calculate total fee
        const totalFee = x0.mul(term1.add(term2)).add(b.mul(term3))

        // convert to trading fee: trading_fee = total_fee / FEE_DENOMINATOR
        tradingFee = totalFee.div(new BN(FEE_DENOMINATOR))
    } else {
        // if a >= max_index
        // use MAX_FEE_NUMERATOR for the portion exceeding max_index
        const one = new BN(1)
        const two = new BN(2)
        const c = cliffFeeNumerator
        const x0 = referenceAmount

        // c + c*max_index
        const term1 = c.add(c.mul(maxIndex))

        // i*max_index*(max_index+1)/2
        const term2 = i.mul(maxIndex).mul(maxIndex.add(one)).div(two)

        // calculate fee for the first part (up to max_index)
        const firstPartFee = x0.mul(term1.add(term2))

        // calculate fee for the remaining part (beyond max_index)
        const d = a.sub(maxIndex)
        const leftAmount = d.mul(x0).add(b)
        const secondPartFee = leftAmount.mul(new BN(MAX_FEE_NUMERATOR))

        // calculate total fee
        const totalFee = firstPartFee.add(secondPartFee)

        // convert to trading fee: trading_fee = total_fee / FEE_DENOMINATOR
        tradingFee = totalFee.div(new BN(FEE_DENOMINATOR))
    }

    // convert to fee numerator: fee_numerator = trading_fee * FEE_DENOMINATOR / input_amount
    const feeNumerator = mulDiv(
        tradingFee,
        new BN(FEE_DENOMINATOR),
        inputAmount,
        Rounding.Up
    )

    // cap at MAX_FEE_NUMERATOR
    return BN.min(feeNumerator, new BN(MAX_FEE_NUMERATOR))
}
