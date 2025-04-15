import BN from 'bn.js'
import Decimal from 'decimal.js'
import { SafeMath } from './safeMath'
import {
    safeMulDivCastU64,
    bnToDecimal,
    decimalToBN,
    batchBnToDecimal,
    mulDivBN,
} from './utilsMath'
import {
    BASIS_POINT_MAX,
    FEE_DENOMINATOR,
    MAX_FEE_NUMERATOR,
} from '../constants'
import {
    FeeSchedulerMode,
    Rounding,
    type BaseFeeConfig,
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
        return mulDivBN(
            cliffFeeNumerator,
            basisPointMax.sub(reductionFactor),
            basisPointMax,
            Rounding.Down
        )
    }

    // Convert to Decimal for higher precision in one batch
    const [cliffFeeDecimal, reductionFactorDecimal] = batchBnToDecimal(
        cliffFeeNumerator,
        reductionFactor
    )
    const basisPointMaxDecimal = new Decimal(BASIS_POINT_MAX)

    // Batch operations in Decimal
    // Calculate (1 - reduction_factor/10_000)
    if (!basisPointMaxDecimal || !reductionFactorDecimal) {
        throw new Error('GetFeeInPeriod: conversion to Decimal failed')
    }
    const multiplier = basisPointMaxDecimal
        .sub(reductionFactorDecimal)
        .div(basisPointMaxDecimal)

    // Calculate (1 - reduction_factor/10_000)^period in one operation
    if (!cliffFeeDecimal) {
        throw new Error('GetFeeInPeriod: conversion to Decimal failed')
    }
    const feeNumeratorDecimal = cliffFeeDecimal.mul(multiplier.pow(period))

    // Convert back to BN
    return decimalToBN(feeNumeratorDecimal, Rounding.Down)
}

/**
 * Get current base fee numerator
 * @param baseFee Base fee parameters
 * @param currentPoint Current point
 * @param activationPoint Activation point
 * @returns Current base fee numerator
 */
export function getCurrentBaseFeeNumerator(
    baseFee: BaseFeeConfig,
    currentPoint: BN,
    activationPoint: BN
): BN {
    // Early return for zero period frequency
    if (baseFee.periodFrequency.isZero()) {
        return baseFee.cliffFeeNumerator
    }

    // Convert to Decimal for higher precision in one batch
    const [
        currentPointDecimal,
        activationPointDecimal,
        periodFrequencyDecimal,
        cliffFeeNumeratorDecimal,
        reductionFactorDecimal,
    ] = batchBnToDecimal(
        currentPoint,
        activationPoint,
        baseFee.periodFrequency,
        baseFee.cliffFeeNumerator,
        baseFee.reductionFactor
    )

    // Calculate period
    let periodDecimal: Decimal
    if (
        currentPointDecimal &&
        activationPointDecimal &&
        currentPointDecimal.lt(activationPointDecimal)
    ) {
        // Before activation point, use max period (min fee)
        periodDecimal = new Decimal(baseFee.numberOfPeriod)
    } else {
        // Calculate elapsed periods
        periodDecimal = currentPointDecimal
            ? currentPointDecimal
                  .sub(activationPointDecimal ?? new Decimal(0))
                  .div(periodFrequencyDecimal ?? new Decimal(0))
                  .floor()
            : new Decimal(0)

        // Cap at max number of periods
        if (periodDecimal.gt(new Decimal(baseFee.numberOfPeriod))) {
            periodDecimal = new Decimal(baseFee.numberOfPeriod)
        }
    }

    const feeSchedulerMode = baseFee.feeSchedulerMode

    if (feeSchedulerMode === FeeSchedulerMode.Linear) {
        // Calculate with Decimal.js in one operation
        const feeNumeratorDecimal = cliffFeeNumeratorDecimal
            ? cliffFeeNumeratorDecimal.sub(
                  periodDecimal.mul(reductionFactorDecimal ?? new Decimal(0))
              )
            : new Decimal(0)

        // Convert back to BN
        return decimalToBN(feeNumeratorDecimal, Rounding.Down)
    } else if (feeSchedulerMode === FeeSchedulerMode.Exponential) {
        // For exponential mode, use the optimized getFeeInPeriod function
        return getFeeInPeriod(
            baseFee.cliffFeeNumerator,
            baseFee.reductionFactor,
            periodDecimal.toNumber()
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
    const tradingFee = safeMulDivCastU64(
        amount,
        totalFeeNumerator,
        new BN(FEE_DENOMINATOR),
        Rounding.Up
    )

    // Update amount
    const amountAfterFee = SafeMath.sub(amount, tradingFee)

    // Calculate protocol fee
    const protocolFee = safeMulDivCastU64(
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
        referralFee = safeMulDivCastU64(
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
 * @param volatilityTracker Volatility tracker
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

    // Convert to Decimal for higher precision
    const volatilityAccumulatorDecimal = bnToDecimal(
        volatilityTracker.volatilityAccumulator
    )
    const binStepDecimal = new Decimal(dynamicFee.binStep)
    const variableFeeControlDecimal = new Decimal(dynamicFee.variableFeeControl)

    // Batch operations in Decimal
    // Calculate (volatilityAccumulator * binStep)^2 * variableFeeControl
    const volatilityTimesBinStep =
        volatilityAccumulatorDecimal.mul(binStepDecimal)
    const vFee = volatilityTimesBinStep.pow(2).mul(variableFeeControlDecimal)

    // Scale down to 1e9 unit with ceiling
    const scaleFactor = new Decimal(100_000_000_000)
    const scaledVFee = vFee
        .add(scaleFactor.sub(new Decimal(1)))
        .div(scaleFactor)
        .floor()

    // Convert back to BN
    return decimalToBN(scaledVFee, Rounding.Down)
}
