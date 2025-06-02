import BN from 'bn.js'
import { pow, SafeMath } from './safeMath'
import { mulDiv } from './utilsMath'
import {
    BASIS_POINT_MAX,
    FEE_DENOMINATOR,
    MAX_FEE_NUMERATOR,
} from '../constants'
import {
    BaseFeeMode,
    Rounding,
    type DynamicFeeConfig,
    type FeeOnAmountResult,
    type PoolFeesConfig,
    type VolatilityTracker,
} from '../types'

/**
 * Get fee in period for exponential fee scheduler
 * @param cliffFeeNumerator Cliff fee numerator
 * @param reductionFactor Reduction factor
 * @param period Period
 * @returns Fee numerator
 */
export function getFeeNumeratorInPeriod(
    cliffFeeNumerator: BN,
    reductionFactor: BN,
    period: number
): BN {
    if (period === 0) {
        return cliffFeeNumerator
    }

    if (period === 1) {
        const basisPointMax = new BN(BASIS_POINT_MAX)
        return mulDiv(
            cliffFeeNumerator,
            basisPointMax.sub(reductionFactor),
            basisPointMax,
            Rounding.Down
        )
    }

    // calculate (1-reduction_factor/10_000)^period
    const basisPointMax = new BN(BASIS_POINT_MAX)

    // base = ONE_Q64 - (reductionFactor << RESOLUTION) / BASIS_POINT_MAX
    const ONE_Q64 = new BN(1).shln(64)
    const reductionFactorScaled = SafeMath.div(
        SafeMath.shl(reductionFactor, 64),
        basisPointMax
    )
    let base = SafeMath.sub(ONE_Q64, reductionFactorScaled)

    const result = pow(base, new BN(period))

    // final fee: cliffFeeNumerator * result >> 64
    return SafeMath.div(SafeMath.mul(cliffFeeNumerator, result), ONE_Q64)
}

export function getFeeNumeratorFromAmount(
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
    const feeIncrementNumerator = mulDiv(
        new BN(feeIncrementBps),
        new BN(FEE_DENOMINATOR),
        new BN(BASIS_POINT_MAX),
        Rounding.Down
    )

    // calculate max index (how many increments until we reach MAX_FEE_NUMERATOR)
    const deltaNumerator = new BN(MAX_FEE_NUMERATOR).sub(cliffFeeNumerator)
    const maxIndex = deltaNumerator.div(feeIncrementNumerator)

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

        // c + c*a
        const term1 = cliffFeeNumerator.add(cliffFeeNumerator.mul(a))

        // i*a*(a+1)/2
        const term2 = feeIncrementNumerator.mul(a).mul(a.add(one)).div(two)

        // c + i*(a+1)
        const term3 = cliffFeeNumerator.add(
            feeIncrementNumerator.mul(a.add(one))
        )

        // calculate total fee
        const totalFee = referenceAmount.mul(term1.add(term2)).add(b.mul(term3))

        // convert to trading fee: trading_fee = total_fee / FEE_DENOMINATOR
        tradingFee = totalFee.div(new BN(FEE_DENOMINATOR))
    } else {
        // if a >= max_index
        // use MAX_FEE_NUMERATOR for the portion exceeding max_index
        const one = new BN(1)
        const two = new BN(2)

        // c + c*max_index
        const term1 = cliffFeeNumerator.add(cliffFeeNumerator.mul(maxIndex))

        // i*max_index*(max_index+1)/2
        const term2 = feeIncrementNumerator
            .mul(maxIndex)
            .mul(maxIndex.add(one))
            .div(two)

        // calculate fee for the first part (up to max_index)
        const firstPartFee = referenceAmount.mul(term1.add(term2))

        // calculate fee for the remaining part (beyond max_index)
        const d = a.sub(maxIndex)
        const leftAmount = d.mul(referenceAmount).add(b)
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

    // Cap at MAX_FEE_NUMERATOR
    return BN.min(feeNumerator, new BN(MAX_FEE_NUMERATOR))
}

/**
 * Get current base fee numerator
 * @param baseFee Base fee parameters
 * @param currentPoint Current point
 * @param activationPoint Activation point
 * @param inputAmount Input amount (optional, used for rate limiter)
 * @returns Current base fee numerator
 */
export function getCurrentBaseFeeNumerator(
    baseFee: {
        cliffFeeNumerator: BN
        firstFactor: number
        secondFactor: BN
        thirdFactor: BN
        baseFeeMode: BaseFeeMode
    },
    currentPoint: BN,
    activationPoint: BN,
    inputAmount?: BN
): BN {
    const baseFeeMode = baseFee.baseFeeMode

    if (baseFeeMode === BaseFeeMode.RateLimiter) {
        // Check if rate limiter is applied
        if (currentPoint.lt(activationPoint)) {
            return baseFee.cliffFeeNumerator
        }

        const lastEffectivePoint = activationPoint.add(baseFee.secondFactor)
        if (currentPoint.gt(lastEffectivePoint)) {
            return baseFee.cliffFeeNumerator
        }

        // If no input amount provided, return base fee
        if (!inputAmount) {
            return baseFee.cliffFeeNumerator
        }

        return getFeeNumeratorFromAmount(
            baseFee.cliffFeeNumerator,
            baseFee.thirdFactor, // reference amount
            new BN(baseFee.firstFactor), // fee increment bps
            inputAmount
        )
    } else {
        if (baseFee.thirdFactor.isZero()) {
            return baseFee.cliffFeeNumerator
        }

        let period: number
        if (currentPoint.lt(activationPoint)) {
            // before activation point, use max period (min fee)
            period = baseFee.firstFactor
        } else {
            const elapsedPoints = SafeMath.sub(currentPoint, activationPoint)
            const periodCount = SafeMath.div(elapsedPoints, baseFee.thirdFactor)

            period = Math.min(
                parseInt(periodCount.toString()),
                baseFee.firstFactor
            )
        }

        if (baseFeeMode === BaseFeeMode.FeeSchedulerLinear) {
            // linear fee calculation: cliffFeeNumerator - period * reductionFactor
            const reduction = SafeMath.mul(new BN(period), baseFee.secondFactor)

            if (reduction.gt(baseFee.cliffFeeNumerator)) {
                return new BN(0)
            }

            return SafeMath.sub(baseFee.cliffFeeNumerator, reduction)
        } else {
            // exponential fee calculation: cliff_fee_numerator * (1 - reduction_factor/10_000)^period
            return getFeeNumeratorInPeriod(
                baseFee.cliffFeeNumerator,
                baseFee.secondFactor,
                period
            )
        }
    }
}

/**
 * Get variable fee from dynamic fee
 * @param dynamicFee Dynamic fee parameters
 * @param volatilityTracker Volatility tracker
 * @returns Variable fee
 */
export function getVariableFee(
    dynamicFee: DynamicFeeConfig,
    volatilityTracker: VolatilityTracker
): BN {
    if (dynamicFee.initialized === 0) {
        return new BN(0)
    }

    if (volatilityTracker.volatilityAccumulator.isZero()) {
        return new BN(0)
    }

    // (volatilityAccumulator * binStep)
    const volatilityTimesBinStep = SafeMath.mul(
        volatilityTracker.volatilityAccumulator,
        new BN(dynamicFee.binStep)
    )

    // (volatilityAccumulator * binStep)^2
    const squared = SafeMath.mul(volatilityTimesBinStep, volatilityTimesBinStep)

    // (volatilityAccumulator * binStep)^2 * variableFeeControl
    const vFee = SafeMath.mul(squared, new BN(dynamicFee.variableFeeControl))

    const scaleFactor = new BN(100_000_000_000)
    const numerator = SafeMath.add(vFee, SafeMath.sub(scaleFactor, new BN(1)))
    return SafeMath.div(numerator, scaleFactor)
}

/**
 * Get fee on amount for rate limiter
 * @param amount Amount
 * @param poolFees Pool fees
 * @param isReferral Whether referral is used
 * @param currentPoint Current point
 * @param activationPoint Activation point
 * @param volatilityTracker Volatility tracker
 * @returns Fee on amount result
 */
export function getFeeOnAmount(
    amount: BN,
    poolFees: PoolFeesConfig,
    isReferral: boolean,
    currentPoint: BN,
    activationPoint: BN,
    volatilityTracker: VolatilityTracker
): FeeOnAmountResult {
    // get total trading fee
    const baseFeeNumerator = getCurrentBaseFeeNumerator(
        poolFees.baseFee,
        currentPoint,
        activationPoint,
        poolFees.baseFee.baseFeeMode === BaseFeeMode.RateLimiter
            ? amount
            : undefined
    )

    // add dynamic fee if enabled
    let totalFeeNumerator = baseFeeNumerator
    if (poolFees.dynamicFee.initialized !== 0) {
        const variableFee = getVariableFee(
            poolFees.dynamicFee,
            volatilityTracker
        )
        totalFeeNumerator = SafeMath.add(totalFeeNumerator, variableFee)
    }

    // cap at MAX_FEE_NUMERATOR
    if (totalFeeNumerator.gt(new BN(MAX_FEE_NUMERATOR))) {
        totalFeeNumerator = new BN(MAX_FEE_NUMERATOR)
    }

    const tradingFee = mulDiv(
        amount,
        totalFeeNumerator,
        new BN(FEE_DENOMINATOR),
        Rounding.Up
    )

    const amountAfterFee = SafeMath.sub(amount, tradingFee)

    const protocolFee = mulDiv(
        tradingFee,
        new BN(poolFees.protocolFeePercent),
        new BN(100),
        Rounding.Down
    )

    const tradingFeeAfterProtocol = SafeMath.sub(tradingFee, protocolFee)

    // referral fee
    let referralFee = new BN(0)
    if (isReferral) {
        referralFee = mulDiv(
            protocolFee,
            new BN(poolFees.referralFeePercent),
            new BN(100),
            Rounding.Down
        )
    }

    // update protocol fee
    const protocolFeeAfterReferral = SafeMath.sub(protocolFee, referralFee)

    return {
        amount: amountAfterFee,
        tradingFee: tradingFeeAfterProtocol,
        protocolFee: protocolFeeAfterReferral,
        referralFee,
    }
}
