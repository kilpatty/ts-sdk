import BN from 'bn.js'
import { SafeMath } from './safeMath'
import { Rounding, safeMulDivCastU64 } from './utilsMath'
import {
    BASIS_POINT_MAX,
    FEE_DENOMINATOR,
    MAX_FEE_NUMERATOR,
} from './constants'

/**
 * Fee scheduler mode
 */
export enum FeeSchedulerMode {
    // fee = cliff_fee_numerator - passed_period * reduction_factor
    Linear = 0,
    // fee = cliff_fee_numerator * (1-reduction_factor/10_000)^passed_period
    Exponential = 1,
}

/**
 * Fee mode
 */
export interface FeeMode {
    feesOnInput: boolean
    feesOnBaseToken: boolean
    hasReferral: boolean
}

/**
 * Fee on amount result
 */
export interface FeeOnAmountResult {
    amount: BN
    tradingFee: BN
    protocolFee: BN
    referralFee: BN
}

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
    if (period === 0) {
        return cliffFeeNumerator
    }

    let feeNumerator = cliffFeeNumerator
    const reductionFactorBasisPoint = SafeMath.div(
        SafeMath.mul(reductionFactor, new BN(BASIS_POINT_MAX)),
        new BN(BASIS_POINT_MAX)
    )

    for (let i = 0; i < period; i++) {
        feeNumerator = SafeMath.div(
            SafeMath.mul(
                feeNumerator,
                SafeMath.sub(new BN(BASIS_POINT_MAX), reductionFactorBasisPoint)
            ),
            new BN(BASIS_POINT_MAX)
        )
    }

    return feeNumerator
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
    if (baseFee.periodFrequency.isZero()) {
        return baseFee.cliffFeeNumerator
    }

    // Can trade before activation point, so if it is alpha-vault, we use min fee
    let period: BN
    if (currentPoint.lt(activationPoint)) {
        period = new BN(baseFee.numberOfPeriod)
    } else {
        period = SafeMath.div(
            SafeMath.sub(currentPoint, activationPoint),
            baseFee.periodFrequency
        )
        if (period.gt(new BN(baseFee.numberOfPeriod))) {
            period = new BN(baseFee.numberOfPeriod)
        }
    }

    const feeSchedulerMode = baseFee.feeSchedulerMode

    if (feeSchedulerMode === FeeSchedulerMode.Linear) {
        const feeNumerator = SafeMath.sub(
            baseFee.cliffFeeNumerator,
            SafeMath.mul(period, baseFee.reductionFactor)
        )
        return feeNumerator
    } else if (feeSchedulerMode === FeeSchedulerMode.Exponential) {
        const feeNumerator = getFeeInPeriod(
            baseFee.cliffFeeNumerator,
            baseFee.reductionFactor,
            period.toNumber()
        )
        return feeNumerator
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
    poolFees: {
        baseFee: {
            cliffFeeNumerator: BN
            feeSchedulerMode: number
            numberOfPeriod: number
            periodFrequency: BN
            reductionFactor: BN
        }
        protocolFeePercent: number
        referralFeePercent: number
        dynamicFee: {
            initialized: number
            maxVolatilityAccumulator: number
            variableFeeControl: number
            binStep: number
            filterPeriod: number
            decayPeriod: number
            reductionFactor: number
            lastUpdateTimestamp: BN
            binStepU128: BN
            sqrtPriceReference: BN
            volatilityAccumulator: BN
            volatilityReference: BN
        }
    },
    isReferral: boolean,
    currentPoint: BN,
    activationPoint: BN
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
        const variableFee = getVariableFee(poolFees.dynamicFee)
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
 * @returns Variable fee
 */
export function getVariableFee(dynamicFee: {
    initialized: number
    maxVolatilityAccumulator: number
    variableFeeControl: number
    binStep: number
    filterPeriod: number
    decayPeriod: number
    reductionFactor: number
    lastUpdateTimestamp: BN
    binStepU128: BN
    sqrtPriceReference: BN
    volatilityAccumulator: BN
    volatilityReference: BN
}): BN {
    if (dynamicFee.initialized === 0) {
        return new BN(0)
    }

    // Square of volatility accumulator * bin step
    const squareVfaBin = SafeMath.mul(
        SafeMath.mul(
            dynamicFee.volatilityAccumulator,
            new BN(dynamicFee.binStep)
        ),
        SafeMath.mul(
            dynamicFee.volatilityAccumulator,
            new BN(dynamicFee.binStep)
        )
    )

    // Variable fee control, volatility accumulator, bin step are in basis point unit (10_000)
    // Scale down to 1e9 unit and ceiling the remaining
    const vFee = SafeMath.mul(
        squareVfaBin,
        new BN(dynamicFee.variableFeeControl)
    )
    const scaledVFee = SafeMath.div(
        SafeMath.add(vFee, new BN(99_999_999_999)),
        new BN(100_000_000_000)
    )

    return scaledVFee
}
