import BN from 'bn.js'
import { MAX_CURVE_POINT, MAX_SQRT_PRICE, MIN_SQRT_PRICE } from './constants'
import {
    ActivationType,
    CollectFeeMode,
    MigrationFeeOption,
    MigrationOption,
    TokenDecimal,
    TokenType,
    type CreateConfigParam,
} from './types'
import { PublicKey } from '@solana/web3.js'
import {
    getBaseTokenForSwap,
    getMigrationBaseToken,
    getMigrationThresholdPrice,
    getSwapAmountWithBuffer,
} from './common'

export function isDefaultLockedVesting(lockedVesting: {
    amountPerPeriod: BN
    cliffDurationFromMigrationTime: BN
    frequency: BN
    numberOfPeriod: BN
    cliffUnlockAmount: BN
}): boolean {
    return (
        lockedVesting.amountPerPeriod.eqn(0) &&
        lockedVesting.cliffDurationFromMigrationTime.eqn(0) &&
        lockedVesting.frequency.eqn(0) &&
        lockedVesting.numberOfPeriod.eqn(0) &&
        lockedVesting.cliffUnlockAmount.eqn(0)
    )
}

export function validatePoolFees(poolFees: any): boolean {
    if (!poolFees) return false

    // check base fee if it exists
    if (poolFees.baseFee) {
        if (poolFees.baseFee.cliffFeeNumerator.lte(new BN(0))) {
            return false
        }
    }

    return true
}

export function getTotalTokenSupply(
    swapBaseAmount: BN,
    migrationBaseThreshold: BN,
    lockedVestingParams: {
        amountPerPeriod: BN
        numberOfPeriod: BN
        cliffUnlockAmount: BN
    }
): BN {
    try {
        // calculate total circulating amount
        const totalCirculatingAmount = swapBaseAmount.add(
            migrationBaseThreshold
        )

        // calculate total locked vesting amount
        const totalLockedVestingAmount =
            lockedVestingParams.cliffUnlockAmount.add(
                lockedVestingParams.amountPerPeriod.mul(
                    lockedVestingParams.numberOfPeriod
                )
            )

        // calculate total amount
        const totalAmount = totalCirculatingAmount.add(totalLockedVestingAmount)

        // check for overflow
        if (totalAmount.isNeg() || totalAmount.bitLength() > 64) {
            throw new Error('Math overflow')
        }

        return totalAmount
    } catch (error) {
        throw new Error('Math overflow')
    }
}

export function validateCollectFeeMode(
    collectFeeMode: CollectFeeMode
): boolean {
    return [CollectFeeMode.OnlyQuote, CollectFeeMode.Both].includes(
        collectFeeMode
    )
}

export function validateMigrationAndTokenType(
    migrationOption: MigrationOption,
    tokenType: TokenType
): boolean {
    if (migrationOption === MigrationOption.MET_DAMM) {
        return tokenType === TokenType.SPL
    }
    return true
}

export function validateActivationType(
    activationType: ActivationType
): boolean {
    return [ActivationType.Slot, ActivationType.Timestamp].includes(
        activationType
    )
}

export function validateMigrationFeeOption(
    migrationFeeOption: MigrationFeeOption
): boolean {
    return [
        MigrationFeeOption.FixedBps25,
        MigrationFeeOption.FixedBps30,
        MigrationFeeOption.FixedBps100,
        MigrationFeeOption.FixedBps200,
    ].includes(migrationFeeOption)
}

export function validateTokenDecimals(tokenDecimal: TokenDecimal): boolean {
    return tokenDecimal >= TokenDecimal.SIX && tokenDecimal <= TokenDecimal.NINE
}

export function validateLPPercentages(
    partnerLpPercentage: number,
    partnerLockedLpPercentage: number,
    creatorLpPercentage: number,
    creatorLockedLpPercentage: number
): boolean {
    const totalLPPercentage =
        partnerLpPercentage +
        partnerLockedLpPercentage +
        creatorLpPercentage +
        creatorLockedLpPercentage
    return totalLPPercentage === 100
}

export function validateCurve(
    curve: Array<{ sqrtPrice: BN; liquidity: BN }>,
    sqrtStartPrice: BN
): boolean {
    if (!curve || curve.length === 0 || curve.length > MAX_CURVE_POINT) {
        return false
    }

    // first curve point validation
    if (
        curve[0]?.sqrtPrice.lte(sqrtStartPrice) ||
        curve[0]?.liquidity.lte(new BN(0)) ||
        curve[0]?.sqrtPrice.gt(new BN(MAX_SQRT_PRICE))
    ) {
        return false
    }

    // validate curve points are in ascending order and have positive liquidity
    for (let i = 1; i < curve.length; i++) {
        const currentPoint = curve[i]
        const previousPoint = curve[i - 1]

        if (!currentPoint || !previousPoint) {
            return false
        }

        if (
            currentPoint.sqrtPrice.lte(previousPoint.sqrtPrice) ||
            currentPoint.liquidity.lte(new BN(0))
        ) {
            return false
        }
    }

    // validate last curve point
    return !curve[curve.length - 1]?.sqrtPrice.gt(new BN(MAX_SQRT_PRICE))
}

export function validateTokenSupply(
    tokenSupply: any,
    leftoverReceiver: PublicKey,
    swapBaseAmount: BN,
    migrationBaseAmount: BN,
    lockedVesting: any,
    swapBaseAmountBuffer: BN
): boolean {
    if (!tokenSupply) return true

    if (!leftoverReceiver) {
        return false
    }

    // Check if it's a PublicKey instance
    if (!(leftoverReceiver instanceof PublicKey)) {
        return false
    }

    // Check if it's not the default public key (all zeros)
    if (leftoverReceiver.equals(PublicKey.default)) {
        return false
    }

    const minimumBaseSupplyWithBuffer = getTotalTokenSupply(
        swapBaseAmountBuffer,
        migrationBaseAmount,
        lockedVesting
    )

    const minimumBaseSupplyWithoutBuffer = getTotalTokenSupply(
        swapBaseAmount,
        migrationBaseAmount,
        lockedVesting
    )

    return !(
        minimumBaseSupplyWithoutBuffer.gt(
            new BN(tokenSupply.postMigrationTokenSupply)
        ) ||
        new BN(tokenSupply.postMigrationTokenSupply).gt(
            new BN(tokenSupply.preMigrationTokenSupply)
        ) ||
        minimumBaseSupplyWithBuffer.gt(
            new BN(tokenSupply.preMigrationTokenSupply)
        )
    )
}

export function validateConfigParameters(
    configParam: Omit<
        CreateConfigParam,
        'config' | 'feeClaimer' | 'quoteMint' | 'payer'
    >
) {
    // Pool fees validation
    if (!configParam.poolFees) {
        throw new Error('Pool fees are required')
    }
    if (!validatePoolFees(configParam.poolFees)) {
        throw new Error('Invalid pool fees')
    }

    // Collect fee mode validation
    if (!validateCollectFeeMode(configParam.collectFeeMode)) {
        throw new Error('Invalid collect fee mode')
    }

    // Migration and token type validation
    if (
        !validateMigrationAndTokenType(
            configParam.migrationOption,
            configParam.tokenType
        )
    ) {
        throw new Error('Token type must be SPL for MeteoraDamm migration')
    }

    // Activation type validation
    if (!validateActivationType(configParam.activationType)) {
        throw new Error('Invalid activation type')
    }

    // Migration fee validation
    if (!validateMigrationFeeOption(configParam.migrationFeeOption)) {
        throw new Error('Invalid migration fee option')
    }

    // Token decimals validation
    if (!validateTokenDecimals(configParam.tokenDecimal)) {
        throw new Error('Token decimal must be between 6 and 9')
    }

    // LP percentages validation
    if (
        !validateLPPercentages(
            configParam.partnerLpPercentage,
            configParam.partnerLockedLpPercentage,
            configParam.creatorLpPercentage,
            configParam.creatorLockedLpPercentage
        )
    ) {
        throw new Error('Sum of LP percentages must equal 100')
    }

    // Migration quote threshold validation
    if (configParam.migrationQuoteThreshold.lte(new BN(0))) {
        throw new Error('Migration quote threshold must be greater than 0')
    }

    // Price validation
    if (
        new BN(configParam.sqrtStartPrice).lt(new BN(MIN_SQRT_PRICE)) ||
        new BN(configParam.sqrtStartPrice).gte(new BN(MAX_SQRT_PRICE))
    ) {
        throw new Error('Invalid sqrt start price')
    }

    // Curve validation
    if (!validateCurve(configParam.curve, configParam.sqrtStartPrice)) {
        throw new Error('Invalid curve')
    }

    // Locked vesting validation
    if (!isDefaultLockedVesting(configParam.lockedVesting)) {
        try {
            const totalAmount = configParam.lockedVesting.cliffUnlockAmount.add(
                configParam.lockedVesting.amountPerPeriod.mul(
                    new BN(configParam.lockedVesting.numberOfPeriod)
                )
            )
            if (
                configParam.lockedVesting.frequency.eq(new BN(0)) ||
                totalAmount.eq(new BN(0))
            ) {
                throw new Error('Invalid vesting parameters')
            }
        } catch (error) {
            throw new Error('Invalid vesting parameters')
        }
    }

    // Token supply validation
    if (configParam.tokenSupply) {
        const sqrtMigrationPrice = getMigrationThresholdPrice(
            configParam.migrationQuoteThreshold,
            configParam.sqrtStartPrice,
            configParam.curve
        )

        const swapBaseAmount = getBaseTokenForSwap(
            configParam.sqrtStartPrice,
            sqrtMigrationPrice,
            configParam.curve
        )

        const migrationBaseAmount = getMigrationBaseToken(
            configParam.migrationQuoteThreshold,
            sqrtMigrationPrice,
            configParam.migrationOption
        )

        const swapBaseAmountBuffer = getSwapAmountWithBuffer(
            swapBaseAmount,
            configParam.sqrtStartPrice,
            configParam.curve
        )

        if (
            !validateTokenSupply(
                configParam.tokenSupply,
                new PublicKey(configParam.leftoverReceiver),
                swapBaseAmount,
                migrationBaseAmount,
                configParam.lockedVesting,
                swapBaseAmountBuffer
            )
        ) {
            throw new Error('Invalid token supply')
        }
    }
}
