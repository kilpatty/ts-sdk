import Decimal from 'decimal.js'
import BN from 'bn.js'
import {
    FeeSchedulerMode,
    type ConfigParameters,
    type DesignConstantProductCurveWithLockVestingParam,
    type DesignConstantProductCurveWithoutLockVestingParam,
    type DesignCurveParam,
    type DesignCurveResponse,
} from './types'
import { MAX_SQRT_PRICE } from './constants'
import {
    getLiquidityBuffer,
    getBaseTokenForMigration,
    getBaseTokenForSwap,
    getPriceFromSqrtPrice,
    getSqrtPriceFromPrice,
} from './common'

/**
 * Design the curve for the Constant Product curve with lock vesting
 * @param designConstantProductCurveWithLockVestingParam - The parameters for the curve
 * @returns The instruction parameters
 */
export function designConstantProductCurveWithLockVesting(
    designConstantProductCurveWithLockVestingParam: DesignConstantProductCurveWithLockVestingParam
): ConfigParameters {
    const {
        totalTokenSupply,
        percentageSupplyOnMigration,
        lockVestingParams,
        startPrice,
        migrationPrice,
        tokenBaseDecimal,
        tokenQuoteDecimal,
        baseFeeBps,
        dynamicFeeEnabled,
        activationType,
        collectFeeMode,
        migrationOption,
        migrationFeeOption,
        tokenType,
        partnerLpPercentage,
        creatorLpPercentage,
        partnerLockedLpPercentage,
        creatorLockedLpPercentage,
    } = designConstantProductCurveWithLockVestingParam

    const totalSupply = new BN(totalTokenSupply).mul(
        new BN(10).pow(new BN(tokenBaseDecimal))
    )
    const baseDecimalFactor = new Decimal(10 ** tokenBaseDecimal)
    const quoteDecimalFactor = new Decimal(10 ** tokenQuoteDecimal)
    const preMigrationTokenSupply = totalSupply
    const postMigrationTokenSupply = totalSupply
    const migrationSupply = totalSupply
        .mul(new BN(percentageSupplyOnMigration))
        .div(new BN(100))

    let lockedVestingAmount = totalSupply
        .mul(new BN(lockVestingParams.percentageSupplyVesting))
        .div(new BN(100))

    const amountPerPeriod =
        lockVestingParams.numberOfPeriod == 0
            ? new BN(0)
            : lockedVestingAmount.div(new BN(lockVestingParams.numberOfPeriod))
    lockedVestingAmount = amountPerPeriod.mul(
        new BN(lockVestingParams.numberOfPeriod)
    )

    const sqrtStartPrice = getSqrtPriceFromPrice(
        startPrice.toString(),
        tokenBaseDecimal,
        tokenQuoteDecimal
    )

    const migrationSqrtPrice = getSqrtPriceFromPrice(
        migrationPrice.toString(),
        tokenBaseDecimal,
        tokenQuoteDecimal
    )

    const priceDelta = migrationSqrtPrice.sub(sqrtStartPrice)

    const migrationQuoteThresholdFloat = migrationPrice
        .mul(new Decimal(migrationSupply.toString()))
        .mul(quoteDecimalFactor)
        .div(baseDecimalFactor)
        .floor()

    const migrationQuoteThreshold = new BN(
        migrationQuoteThresholdFloat.toString()
    )
    const liquidity = migrationQuoteThreshold.shln(128).div(priceDelta)
    const curves = [
        {
            sqrtPrice: migrationSqrtPrice,
            liquidity,
        },
        {
            sqrtPrice: MAX_SQRT_PRICE,
            liquidity: getLiquidityBuffer(
                liquidity,
                migrationSqrtPrice,
                MAX_SQRT_PRICE
            ),
        },
    ]

    // reverse to get amount on swap
    const maxSwapAmount = getBaseTokenForSwap(
        sqrtStartPrice,
        MAX_SQRT_PRICE,
        curves
    )
    const migrationAmount = getBaseTokenForMigration(
        migrationSqrtPrice,
        migrationQuoteThreshold
    )

    const cliffUnlockAmount =
        lockVestingParams.cliffUnlockEnabled == false
            ? new BN(0)
            : totalSupply
                  .sub(maxSwapAmount)
                  .sub(lockedVestingAmount)
                  .sub(migrationAmount)

    const config: ConfigParameters = {
        poolFees: {
            baseFee: {
                cliffFeeNumerator: new BN((baseFeeBps * 100000).toString()),
                numberOfPeriod: 0,
                reductionFactor: new BN('0'),
                periodFrequency: new BN('0'),
                feeSchedulerMode: FeeSchedulerMode.Linear,
            },
            dynamicFee: dynamicFeeEnabled
                ? {
                      binStep: 1,
                      binStepU128: new BN('1844674407370955'),
                      filterPeriod: 10,
                      decayPeriod: 120,
                      reductionFactor: 5000,
                      variableFeeControl: 2000000,
                      maxVolatilityAccumulator: 100000,
                  }
                : null,
        },
        activationType: activationType,
        collectFeeMode: collectFeeMode,
        migrationOption: migrationOption,
        tokenType: tokenType,
        tokenDecimal: tokenBaseDecimal,
        migrationQuoteThreshold: new BN(migrationQuoteThreshold.toString()),
        partnerLpPercentage: partnerLpPercentage,
        creatorLpPercentage: creatorLpPercentage,
        partnerLockedLpPercentage: partnerLockedLpPercentage,
        creatorLockedLpPercentage: creatorLockedLpPercentage,
        sqrtStartPrice: new BN(sqrtStartPrice.toString()),
        lockedVesting: {
            amountPerPeriod: new BN(amountPerPeriod.toString()),
            cliffDurationFromMigrationTime: new BN('0'),
            frequency: new BN(lockVestingParams.frequency.toString()),
            numberOfPeriod: new BN(lockVestingParams.numberOfPeriod.toString()),
            cliffUnlockAmount: new BN(cliffUnlockAmount.toString()),
        },
        migrationFeeOption: migrationFeeOption,
        tokenSupply: {
            preMigrationTokenSupply: new BN(preMigrationTokenSupply.toString()),
            postMigrationTokenSupply: new BN(
                postMigrationTokenSupply.toString()
            ),
        },
        padding: [
            new BN(0),
            new BN(0),
            new BN(0),
            new BN(0),
            new BN(0),
            new BN(0),
            new BN(0),
        ],
        curve: curves.map((point) => ({
            sqrtPrice: new BN(point.sqrtPrice.toString()),
            liquidity: new BN(point.liquidity.toString()),
        })),
    }

    return config
}

/**
 * Design the curve for the Constant Product curve without lock vesting
 * @param designConstantProductCurveWithoutLockVestingParam - The parameters for the curve
 * @returns The instruction parameters
 */
export function designConstantProductCurveWithoutLockVesting(
    designConstantProductCurveWithoutLockVestingParam: DesignConstantProductCurveWithoutLockVestingParam
): ConfigParameters {
    const {
        totalTokenSupply,
        percentageSupplyOnMigration,
        startPrice,
        tokenBaseDecimal,
        tokenQuoteDecimal,
        baseFeeBps,
        dynamicFeeEnabled,
        activationType,
        collectFeeMode,
        migrationOption,
        migrationFeeOption,
        tokenType,
        partnerLpPercentage,
        creatorLpPercentage,
        partnerLockedLpPercentage,
        creatorLockedLpPercentage,
    } = designConstantProductCurveWithoutLockVestingParam

    const totalSupply = new BN(totalTokenSupply).mul(
        new BN(10).pow(new BN(tokenBaseDecimal))
    )
    const baseDecimalFactor = new Decimal(10 ** tokenBaseDecimal)
    const quoteDecimalFactor = new Decimal(10 ** tokenQuoteDecimal)
    const preMigrationTokenSupply = totalSupply
    const postMigrationTokenSupply = totalSupply
    const migrationSupply = totalSupply
        .mul(new BN(percentageSupplyOnMigration))
        .div(new BN(100))
    const swapSupply = totalSupply.sub(migrationSupply)

    const sqrtStartPrice = getSqrtPriceFromPrice(
        startPrice.toString(),
        tokenBaseDecimal,
        tokenQuoteDecimal
    )
    let migrationSqrtPrice = sqrtStartPrice.mul(swapSupply).div(migrationSupply)
    migrationSqrtPrice = migrationSqrtPrice.sub(new BN(1))
    const priceDelta = migrationSqrtPrice.sub(sqrtStartPrice)

    const migrationPrice = getPriceFromSqrtPrice(
        migrationSqrtPrice,
        tokenBaseDecimal,
        tokenQuoteDecimal
    )
    const migrationQuoteThresholdFloat = migrationPrice
        .mul(new Decimal(migrationSupply.toString()))
        .mul(quoteDecimalFactor)
        .div(baseDecimalFactor)
        .floor()

    const migrationQuoteThreshold = new BN(
        migrationQuoteThresholdFloat.toString()
    )

    const liquidity = migrationQuoteThreshold.shln(128).div(priceDelta)
    const curves = [
        {
            sqrtPrice: migrationSqrtPrice,
            liquidity,
        },
        {
            sqrtPrice: MAX_SQRT_PRICE,
            liquidity: getLiquidityBuffer(
                liquidity,
                migrationSqrtPrice,
                MAX_SQRT_PRICE
            ),
        },
    ]

    const config: ConfigParameters = {
        poolFees: {
            baseFee: {
                cliffFeeNumerator: new BN((baseFeeBps * 100000).toString()),
                numberOfPeriod: 0,
                reductionFactor: new BN('0'),
                periodFrequency: new BN('0'),
                feeSchedulerMode: FeeSchedulerMode.Linear,
            },
            dynamicFee: dynamicFeeEnabled
                ? {
                      binStep: 1,
                      binStepU128: new BN('1844674407370955'),
                      filterPeriod: 10,
                      decayPeriod: 120,
                      reductionFactor: 5000,
                      variableFeeControl: 2000000,
                      maxVolatilityAccumulator: 100000,
                  }
                : null,
        },
        activationType: activationType,
        collectFeeMode: collectFeeMode,
        migrationOption: migrationOption,
        tokenType: tokenType,
        tokenDecimal: tokenBaseDecimal,
        migrationQuoteThreshold: new BN(migrationQuoteThreshold.toString()),
        partnerLpPercentage: partnerLpPercentage,
        creatorLpPercentage: creatorLpPercentage,
        partnerLockedLpPercentage: partnerLockedLpPercentage,
        creatorLockedLpPercentage: creatorLockedLpPercentage,
        sqrtStartPrice: new BN(sqrtStartPrice.toString()),
        lockedVesting: {
            amountPerPeriod: new BN('0'),
            cliffDurationFromMigrationTime: new BN('0'),
            frequency: new BN('0'),
            numberOfPeriod: new BN('0'),
            cliffUnlockAmount: new BN('0'),
        },
        migrationFeeOption: migrationFeeOption,
        tokenSupply: {
            preMigrationTokenSupply: new BN(preMigrationTokenSupply.toString()),
            postMigrationTokenSupply: new BN(
                postMigrationTokenSupply.toString()
            ),
        },
        padding: [
            new BN(0),
            new BN(0),
            new BN(0),
            new BN(0),
            new BN(0),
            new BN(0),
            new BN(0),
        ],
        curve: curves.map((point) => ({
            sqrtPrice: new BN(point.sqrtPrice.toString()),
            liquidity: new BN(point.liquidity.toString()),
        })),
    }

    return config
}

/**
 * Design a Constant Product curve
 * @param params - The parameters for the curve
 * @returns The instruction parameters
 */
export async function designCurve(
    params: DesignCurveParam
): Promise<DesignCurveResponse> {
    const {
        tokenDecimal,
        migrationQuoteThreshold,
        tokenBaseSupply,
        migrationBasePercent,
    } = params

    const Q64 = new BN(2).pow(new BN(64))
    const Q128 = Q64.mul(Q64)
    const Q64_DEC = new Decimal(Q64.toString())

    // Scale the base supply by the migration percent and token decimals
    // baseSupplyDecimal: e.g. 1e9
    // migrationBaseSupplyDecimal = 1e9 * 0.15 * 10^9 = 1.5e17
    const baseSupplyDecimal = new Decimal(tokenBaseSupply.toString())
    const migrationBaseSupplyDecimal = baseSupplyDecimal
        .mul(migrationBasePercent / 100)
        .mul(new Decimal(10).pow(tokenDecimal))

    // quoteThresholdDecimal: e.g. 80 * 10^9
    const quoteThresholdDecimal = new Decimal(
        migrationQuoteThreshold.toString()
    )

    // Compute Pmax = ceil( sqrt(quote/base) * 2^64 )
    const priceDecimal = quoteThresholdDecimal.div(migrationBaseSupplyDecimal)
    const sqrtPriceDecimal = priceDecimal.sqrt()
    const PmaxDEC = sqrtPriceDecimal.mul(Q64_DEC).ceil()
    const PmaxBN = new BN(PmaxDEC.toFixed(0), 10)

    // Pmin = floor((2^128 / 10_000_000) / Pmax)
    const ratioBN = Q128.div(new BN(10_000_000))
    const PminBN = ratioBN.div(PmaxBN)

    // sqrt_start_price in Q64 is exactly Pmin
    const sqrtStartPrice = PminBN

    // liquidity = floor( quote * 2^128 / (Pmax – Pmin) )
    const liquidity = migrationQuoteThreshold.mul(Q128).div(PmaxBN.sub(PminBN))

    return {
        sqrtStartPrice,
        curve: [
            {
                sqrtPrice: MAX_SQRT_PRICE,
                liquidity,
            },
        ],
    }
}
