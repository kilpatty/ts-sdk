import Decimal from 'decimal.js'
import BN from 'bn.js'
import {
    ActivationType,
    CollectFeeMode,
    FeeSchedulerMode,
    MigrationFeeOption,
    MigrationOption,
    TokenType,
    type ConfigParameters,
    type DesignCurveParam,
    type DesignCurveResponse,
} from './types'
import { MAX_SQRT_PRICE } from './constants'
import {
    getBaseTokenForMigration,
    getBaseTokenForSwap,
    getPriceFromSqrtPrice,
    getSqrtPriceFromPrice,
} from './common'

/**
 * Design the curve for the Pumpfun curve
 * @param totalTokenSupply - The total token supply
 * @param percentageSupplyOnMigration - The percentage of supply on migration
 * @param percentageSupplyVesting - The percentage of supply on vesting
 * @param frequency - The frequency of the vesting
 * @param numberOfPeriod - The number of periods of the vesting
 * @param startPrice - The start price of the curve
 * @param migrationPrice - The migration price of the curve
 * @param tokenBaseDecimal - The base token decimal
 * @param tokenQuoteDecimal - The quote token decimal
 * @returns The instruction parameters
 */
export function designPumpFunCurve(
    totalTokenSupply: number,
    percentageSupplyOnMigration: number,
    percentageSupplyVesting: number,
    frequency: number,
    numberOfPeriod: number,
    startPrice: Decimal,
    migrationPrice: Decimal,
    tokenBaseDecimal: number,
    tokenQuoteDecimal: number
): ConfigParameters {
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
        .mul(new BN(percentageSupplyVesting))
        .div(new BN(100))

    const amountPerPeriod =
        numberOfPeriod == 0
            ? new BN(0)
            : lockedVestingAmount.div(new BN(numberOfPeriod))
    lockedVestingAmount = amountPerPeriod.mul(new BN(numberOfPeriod))

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
            liquidity: new BN(1),
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
        percentageSupplyVesting == 0
            ? new BN(0)
            : totalSupply
                  .sub(maxSwapAmount)
                  .sub(lockedVestingAmount)
                  .sub(migrationAmount)

    const config: ConfigParameters = {
        poolFees: {
            baseFee: {
                cliffFeeNumerator: new BN('2500000'),
                numberOfPeriod: 0,
                reductionFactor: new BN('0'),
                periodFrequency: new BN('0'),
                feeSchedulerMode: FeeSchedulerMode.Linear,
            },
            dynamicFee: null,
        },
        activationType: ActivationType.Slot,
        collectFeeMode: CollectFeeMode.Both,
        migrationOption: MigrationOption.MET_DAMM,
        tokenType: TokenType.SPL,
        tokenDecimal: tokenBaseDecimal,
        migrationQuoteThreshold: new BN(migrationQuoteThreshold.toString()),
        partnerLpPercentage: 0,
        creatorLpPercentage: 0,
        partnerLockedLpPercentage: 100,
        creatorLockedLpPercentage: 0,
        sqrtStartPrice: new BN(sqrtStartPrice.toString()),
        lockedVesting: {
            amountPerPeriod: new BN(amountPerPeriod.toString()),
            cliffDurationFromMigrationTime: new BN('0'),
            frequency: new BN(frequency.toString()),
            numberOfPeriod: new BN(numberOfPeriod.toString()),
            cliffUnlockAmount: new BN(cliffUnlockAmount.toString()),
        },
        migrationFeeOption: MigrationFeeOption.FixedBps25,
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
 * Design the curve for the Pump Fun curve without lock vesting
 * @param totalTokenSupply - The total token supply
 * @param percentageSupplyOnMigration - The percentage of supply on migration
 * @param startPrice - The start price of the curve
 * @param tokenBaseDecimal - The base token decimal
 * @param tokenQuoteDecimal - The quote token decimal
 * @returns The instruction parameters
 */
export function designPumpFunCurveWithoutLockVesting(
    totalTokenSupply: number,
    percentageSupplyOnMigration: number,
    startPrice: Decimal,
    tokenBaseDecimal: number,
    tokenQuoteDecimal: number
): ConfigParameters {
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
            liquidity: new BN(1),
        },
    ]

    const config: ConfigParameters = {
        poolFees: {
            baseFee: {
                cliffFeeNumerator: new BN('2500000'),
                numberOfPeriod: 0,
                reductionFactor: new BN('0'),
                periodFrequency: new BN('0'),
                feeSchedulerMode: FeeSchedulerMode.Linear,
            },
            dynamicFee: null,
        },
        activationType: ActivationType.Slot,
        collectFeeMode: CollectFeeMode.Both,
        migrationOption: MigrationOption.MET_DAMM,
        tokenType: TokenType.SPL,
        tokenDecimal: tokenBaseDecimal,
        migrationQuoteThreshold: new BN(migrationQuoteThreshold.toString()),
        partnerLpPercentage: 0,
        creatorLpPercentage: 0,
        partnerLockedLpPercentage: 100,
        creatorLockedLpPercentage: 0,
        sqrtStartPrice: new BN(sqrtStartPrice.toString()),
        lockedVesting: {
            amountPerPeriod: new BN('0'),
            cliffDurationFromMigrationTime: new BN('0'),
            frequency: new BN('0'),
            numberOfPeriod: new BN('0'),
            cliffUnlockAmount: new BN('0'),
        },
        migrationFeeOption: MigrationFeeOption.FixedBps25,
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
 * Design the curve for the Pump Fun curve
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
    // migrationBaseSupplyDecimal = 1e9 * 0.2 * 10^9 = 2e17
    const baseSupplyDecimal = new Decimal(tokenBaseSupply.toString())
    const migrationBaseSupplyDecimal = baseSupplyDecimal
        .mul(migrationBasePercent)
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
