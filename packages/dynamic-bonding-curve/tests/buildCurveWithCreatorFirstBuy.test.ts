import { expect, test, describe } from 'bun:test'
import { buildCurveWithCreatorFirstBuy } from '../src/helpers'
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
import Decimal from 'decimal.js'
import { convertBNToDecimal } from './utils/common'

describe('buildCurveWithCreatorFirstBuy tests', () => {
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

    test('build curve with creator first buy', () => {
        console.log('\n testing build curve with creator first buy...')

        let liquidityWeights: number[] = []
        for (let i = 0; i < 16; i++) {
            if (i < 15) {
                liquidityWeights[i] = new Decimal(1.45)
                    .pow(new Decimal(i))
                    .toNumber()
            } else {
                liquidityWeights[i] = 90
            }
        }
        console.log('liquidityWeights:', liquidityWeights)

        const curveGraphParams = {
            ...baseParams,
            totalTokenSupply: 1000000000,
            initialMarketCap: 200000,
            migrationMarketCap: 1000000,
            tokenQuoteDecimal: TokenDecimal.NINE,
            tokenBaseDecimal: TokenDecimal.SIX,
            leftover: 200000000,
            liquidityWeights,
            migrationOption: MigrationOption.MET_DAMM,
            creatorFirstBuyOption: {
                quoteAmount: 0.01,
                baseAmount: 10000000,
            },
        }

        const config = buildCurveWithCreatorFirstBuy(curveGraphParams)

        console.log(
            'migrationQuoteThreshold: %d',
            config.migrationQuoteThreshold
                .div(new BN(10 ** TokenDecimal.NINE))
                .toString()
        )
        console.log('sqrtStartPrice', convertBNToDecimal(config.sqrtStartPrice))
        console.log('curve', convertBNToDecimal(config.curve))
        expect(config).toBeDefined()
    })
})
