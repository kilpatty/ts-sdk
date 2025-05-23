import { expect, test, describe } from 'bun:test'
import { buildCurveWithTwoSegments } from '../src/helpers'
import BN from 'bn.js'
import {
    ActivationType,
    CollectFeeMode,
    FeeSchedulerMode,
    MigrationFeeOption,
    MigrationOption,
    TokenDecimal,
    TokenType,
} from '../src'
import { convertBNToDecimal } from './utils/common'

describe('buildCurveWithTwoSegments tests', () => {
    const baseParams = {
        totalTokenSupply: 1000000000,
        migrationOption: MigrationOption.MET_DAMM_V2,
        tokenBaseDecimal: TokenDecimal.SIX,
        tokenQuoteDecimal: TokenDecimal.NINE,
        lockedVestingParam: {
            totalLockedVestingAmount: 0,
            numberOfVestingPeriod: 0,
            cliffUnlockAmount: 0,
            totalVestingDuration: 0,
            cliffDurationFromMigrationTime: 0,
        },
        feeSchedulerParam: {
            startingFeeBps: 100,
            endingFeeBps: 100,
            numberOfPeriod: 0,
            totalDuration: 0,
            feeSchedulerMode: FeeSchedulerMode.Linear,
        },
        dynamicFeeEnabled: true,
        activationType: ActivationType.Slot,
        collectFeeMode: CollectFeeMode.OnlyQuote,
        migrationFeeOption: MigrationFeeOption.FixedBps100,
        tokenType: TokenType.SPL,
        partnerLpPercentage: 0,
        creatorLpPercentage: 0,
        partnerLockedLpPercentage: 100,
        creatorLockedLpPercentage: 0,
        creatorTradingFeePercentage: 0,
        leftover: 10000,
    }

    test('build curve with two segments', () => {
        console.log('\n testing build curve with two segments...')

        const config = buildCurveWithTwoSegments({
            ...baseParams,
            initialMarketCap: 200000,
            migrationMarketCap: 1000000,
            percentageSupplyOnMigration: 20,
            lockedVestingParam: {
                totalLockedVestingAmount: 0,
                numberOfVestingPeriod: 0,
                cliffUnlockAmount: 0,
                totalVestingDuration: 0,
                cliffDurationFromMigrationTime: 0,
            },
            feeSchedulerParam: {
                startingFeeBps: 5000,
                endingFeeBps: 100,
                numberOfPeriod: 120,
                totalDuration: 120,
                feeSchedulerMode: FeeSchedulerMode.Exponential,
            },
            dynamicFeeEnabled: true,
            activationType: ActivationType.Slot,
            collectFeeMode: CollectFeeMode.OnlyQuote,
            migrationFeeOption: MigrationFeeOption.FixedBps100,
            tokenType: TokenType.SPL,
            partnerLpPercentage: 0,
            creatorLpPercentage: 0,
            partnerLockedLpPercentage: 100,
            creatorLockedLpPercentage: 0,
            creatorTradingFeePercentage: 0,
            leftover: 350000000,
        })

        console.log(
            'migrationQuoteThreshold: %d',
            config.migrationQuoteThreshold
                .div(new BN(10 ** TokenDecimal.NINE))
                .toString()
        )
        console.log(
            'baseFeeParams',
            convertBNToDecimal(config.poolFees.baseFee)
        )
        console.log(
            'lockedVestingParams',
            convertBNToDecimal(config.lockedVesting)
        )
        console.log('sqrtStartPrice', convertBNToDecimal(config.sqrtStartPrice))
        console.log('curve', convertBNToDecimal(config.curve))
        expect(config).toBeDefined()
    })
})
