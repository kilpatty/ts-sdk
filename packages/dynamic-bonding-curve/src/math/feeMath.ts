import BN from 'bn.js'
import { pow, SafeMath } from './safeMath'
import { mulDiv } from './utilsMath'
import {
    BASIS_POINT_MAX,
    FEE_DENOMINATOR,
    MAX_FEE_NUMERATOR,
} from '../constants'
import {
    FeeSchedulerMode,
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
export function getFeeInPeriod(
    cliffFeeNumerator: BN,
    reductionFactor: BN,
    period: number
): BN {
    // Early return for period 0
    if (period === 0) {
        return cliffFeeNumerator
    }

    // Early return for period 1 with simple calculation
    if (period === 1) {
        const basisPointMax = new BN(BASIS_POINT_MAX)
        return mulDiv(
            cliffFeeNumerator,
            basisPointMax.sub(reductionFactor),
            basisPointMax,
            Rounding.Down
        )
    }

    // For higher periods, calculate (1-reduction_factor/10_000)^period
    const basisPointMax = new BN(BASIS_POINT_MAX)

    // Calculate base = ONE_Q64 - (reductionFactor << RESOLUTION) / BASIS_POINT_MAX
    const ONE_Q64 = new BN(1).shln(64)
    const reductionFactorScaled = SafeMath.div(
        SafeMath.shl(reductionFactor, 64),
        basisPointMax
    )
    let base = SafeMath.sub(ONE_Q64, reductionFactorScaled)

    // Binary exponentiation to calculate base^period
    const result = pow(base, new BN(period))

    // Calculate final fee: cliffFeeNumerator * result >> 64
    return SafeMath.div(SafeMath.mul(cliffFeeNumerator, result), ONE_Q64)
}

/**
 * Get current base fee numerator
 * @param baseFee Base fee parameters
 * @param currentPoint Current point
 * @param activationPoint Activation point
 * @returns Current base fee numerator
 */
export function getCurrentBaseFeeNumerator(
    baseFee: {
        cliffFeeNumerator: BN
        feeSchedulerMode: number
        numberOfPeriod: number
        periodFrequency: BN
        reductionFactor: BN
    },
    currentPoint: BN,
    activationPoint: BN
): BN {
    // Early return for zero period frequency
    if (baseFee.periodFrequency.isZero()) {
        return baseFee.cliffFeeNumerator
    }

    // Calculate period
    let period: number
    if (currentPoint.lt(activationPoint)) {
        // Before activation point, use max period (min fee)
        period = baseFee.numberOfPeriod
    } else {
        // Calculate elapsed periods
        const elapsedPoints = SafeMath.sub(currentPoint, activationPoint)
        const periodCount = SafeMath.div(elapsedPoints, baseFee.periodFrequency)

        // Convert to number for comparison
        period = Math.min(
            parseInt(periodCount.toString()),
            baseFee.numberOfPeriod
        )
    }

    const feeSchedulerMode = baseFee.feeSchedulerMode

    if (feeSchedulerMode === FeeSchedulerMode.Linear) {
        // Linear fee calculation: cliffFeeNumerator - period * reductionFactor
        const reduction = SafeMath.mul(new BN(period), baseFee.reductionFactor)

        if (reduction.gt(baseFee.cliffFeeNumerator)) {
            return new BN(0)
        }

        return SafeMath.sub(baseFee.cliffFeeNumerator, reduction)
    } else if (feeSchedulerMode === FeeSchedulerMode.Exponential) {
        // For exponential mode, use the optimized getFeeInPeriod function
        return getFeeInPeriod(
            baseFee.cliffFeeNumerator,
            baseFee.reductionFactor,
            period
        )
    } else {
        throw new Error('Invalid fee scheduler mode')
    }
}

/**
 * Get fee on amount
 * @param amount Amount
 * @param poolFees Pool fees
 * @param isReferral Whether referral is used
 * @param currentPoint Current point
 * @param activationPoint Activation point
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
    // Get total trading fee
    const baseFeeNumerator = getCurrentBaseFeeNumerator(
        poolFees.baseFee,
        currentPoint,
        activationPoint
    )

    // Add dynamic fee if enabled
    let totalFeeNumerator = baseFeeNumerator
    if (poolFees.dynamicFee.initialized !== 0) {
        const variableFee = getVariableFee(
            poolFees.dynamicFee,
            volatilityTracker
        )
        totalFeeNumerator = SafeMath.add(totalFeeNumerator, variableFee)
    }

    // Cap at MAX_FEE_NUMERATOR
    if (totalFeeNumerator.gt(new BN(MAX_FEE_NUMERATOR))) {
        totalFeeNumerator = new BN(MAX_FEE_NUMERATOR)
    }

    // Calculate trading fee
    const tradingFee = mulDiv(
        amount,
        totalFeeNumerator,
        new BN(FEE_DENOMINATOR),
        Rounding.Up
    )

    // Update amount
    const amountAfterFee = SafeMath.sub(amount, tradingFee)

    // Calculate protocol fee
    const protocolFee = mulDiv(
        tradingFee,
        new BN(poolFees.protocolFeePercent),
        new BN(100),
        Rounding.Down
    )

    // Update trading fee
    const tradingFeeAfterProtocol = SafeMath.sub(tradingFee, protocolFee)

    // Calculate referral fee
    let referralFee = new BN(0)
    if (isReferral) {
        referralFee = mulDiv(
            protocolFee,
            new BN(poolFees.referralFeePercent),
            new BN(100),
            Rounding.Down
        )
    }

    // Update protocol fee
    const protocolFeeAfterReferral = SafeMath.sub(protocolFee, referralFee)

    return {
        amount: amountAfterFee,
        tradingFee: tradingFeeAfterProtocol,
        protocolFee: protocolFeeAfterReferral,
        referralFee,
    }
}

/**
 * Get variable fee from dynamic fee
 * @param dynamicFee Dynamic fee parameters
 * @returns Variable fee
 */
export function getVariableFee(
    dynamicFee: DynamicFeeConfig,
    volatilityTracker: VolatilityTracker
): BN {
    // Early return if not initialized
    if (dynamicFee.initialized === 0) {
        return new BN(0)
    }

    // Early return if volatility accumulator is zero
    if (volatilityTracker.volatilityAccumulator.isZero()) {
        return new BN(0)
    }

    // Calculate (volatilityAccumulator * binStep)
    const volatilityTimesBinStep = SafeMath.mul(
        volatilityTracker.volatilityAccumulator,
        new BN(dynamicFee.binStep)
    )

    // Calculate (volatilityAccumulator * binStep)^2
    const squared = SafeMath.mul(volatilityTimesBinStep, volatilityTimesBinStep)

    // Calculate (volatilityAccumulator * binStep)^2 * variableFeeControl
    const vFee = SafeMath.mul(squared, new BN(dynamicFee.variableFeeControl))

    // Scale down to 1e9 unit with ceiling
    const scaleFactor = new BN(100_000_000_000)
    const numerator = SafeMath.add(vFee, SafeMath.sub(scaleFactor, new BN(1)))
    return SafeMath.div(numerator, scaleFactor)
}
