import {
    ActivationType,
    getRateLimiterParams,
    calculateRateLimiterFee,
    BaseFeeMode,
    bpsToFeeNumerator,
    FEE_DENOMINATOR,
    MAX_FEE_NUMERATOR,
} from '../src'
import { expect, test, describe } from 'bun:test'
import BN from 'bn.js'

describe('Rate Limiter tests', () => {
    test('getRateLimiterParams with Slot activation type', () => {
        const baseFeeBps = 100 // 1%
        const maxFeeBps = 500 // 5%
        const referenceAmount = 1000
        const maxRateLimiterDuration = 100000 // slots
        const tokenQuoteDecimal = 6
        const activationType = ActivationType.Slot

        const params = getRateLimiterParams(
            baseFeeBps,
            maxFeeBps,
            referenceAmount,
            maxRateLimiterDuration,
            tokenQuoteDecimal,
            activationType
        )

        // Verify the parameters
        expect(params.baseFeeMode).toBe(BaseFeeMode.RateLimiter)
        expect(params.cliffFeeNumerator.toNumber()).toBe(
            bpsToFeeNumerator(baseFeeBps).toNumber()
        )
        expect(params.firstFactor).toBeGreaterThan(0) // feeIncrementBps
        expect(params.secondFactor.toNumber()).toBe(maxRateLimiterDuration)
        expect(params.thirdFactor.toNumber()).toBe(
            referenceAmount * 10 ** tokenQuoteDecimal
        )
    })

    test('getRateLimiterParams with Timestamp activation type', () => {
        const baseFeeBps = 100 // 1%
        const maxFeeBps = 500 // 5%
        const referenceAmount = 1000
        const maxRateLimiterDuration = 40000 // seconds
        const tokenQuoteDecimal = 6
        const activationType = ActivationType.Timestamp

        const params = getRateLimiterParams(
            baseFeeBps,
            maxFeeBps,
            referenceAmount,
            maxRateLimiterDuration,
            tokenQuoteDecimal,
            activationType
        )

        // Verify the parameters
        expect(params.baseFeeMode).toBe(BaseFeeMode.RateLimiter)
        expect(params.cliffFeeNumerator.toNumber()).toBe(
            bpsToFeeNumerator(baseFeeBps).toNumber()
        )
        expect(params.firstFactor).toBeGreaterThan(0) // feeIncrementBps
        expect(params.secondFactor.toNumber()).toBe(maxRateLimiterDuration)
        expect(params.thirdFactor.toNumber()).toBe(
            referenceAmount * 10 ** tokenQuoteDecimal
        )
    })

    test('getRateLimiterParams validation errors', () => {
        // Test base fee validation
        expect(() => {
            getRateLimiterParams(
                0, // invalid base fee
                500,
                1000,
                100000,
                6,
                ActivationType.Slot
            )
        }).toThrow('Base fee and max fee must be greater than zero')

        // Test max fee validation
        expect(() => {
            getRateLimiterParams(
                100,
                0, // invalid max fee
                1000,
                100000,
                6,
                ActivationType.Slot
            )
        }).toThrow('Base fee and max fee must be greater than zero')

        // Test base fee > max fee validation
        expect(() => {
            getRateLimiterParams(
                600, // base fee > max fee
                500,
                1000,
                100000,
                6,
                ActivationType.Slot
            )
        }).toThrow('Base fee must be less than or equal to max fee')

        // Test reference amount validation
        expect(() => {
            getRateLimiterParams(
                100,
                500,
                0, // invalid reference amount
                100000,
                6,
                ActivationType.Slot
            )
        }).toThrow('Reference amount must be greater than zero')

        // Test max duration validation
        expect(() => {
            getRateLimiterParams(
                100,
                500,
                1000,
                0, // invalid max duration
                6,
                ActivationType.Slot
            )
        }).toThrow('Max duration must be greater than zero')
    })

    test('calculateRateLimiterFee with different input amounts', () => {
        const baseFeeBps = 100 // 1%
        const maxFeeBps = 500 // 5%
        const referenceAmount = 1000
        const maxRateLimiterDuration = 100000
        const tokenQuoteDecimal = 6
        const activationType = ActivationType.Slot

        const params = getRateLimiterParams(
            baseFeeBps,
            maxFeeBps,
            referenceAmount,
            maxRateLimiterDuration,
            tokenQuoteDecimal,
            activationType
        )

        // Test fee calculation for input amount <= reference amount
        const inputAmount1 = new BN(500)
        const fee1 = calculateRateLimiterFee(params, inputAmount1)
        expect(fee1.toNumber()).toBe(
            inputAmount1
                .mul(params.cliffFeeNumerator)
                .div(new BN(FEE_DENOMINATOR))
                .toNumber()
        )

        // Test fee calculation for input amount > reference amount but < 2 * reference amount
        const inputAmount2 = new BN(1500)
        const fee2 = calculateRateLimiterFee(params, inputAmount2)
        expect(fee2.toNumber()).toBeGreaterThan(fee1.toNumber())

        // Test fee calculation for input amount >> reference amount
        const inputAmount3 = new BN(10000)
        const fee3 = calculateRateLimiterFee(params, inputAmount3)
        expect(fee3.toNumber()).toBeGreaterThan(fee2.toNumber())

        // Verify that fees are increasing with input amount
        expect(fee3.toNumber()).toBeGreaterThan(fee2.toNumber())
        expect(fee2.toNumber()).toBeGreaterThan(fee1.toNumber())
    })

    test('calculateRateLimiterFee with maximum fee cap', () => {
        const baseFeeBps = 100 // 1%
        const maxFeeBps = 500 // 5%
        const referenceAmount = 1000
        const maxRateLimiterDuration = 100000
        const tokenQuoteDecimal = 6
        const activationType = ActivationType.Slot

        const params = getRateLimiterParams(
            baseFeeBps,
            maxFeeBps,
            referenceAmount,
            maxRateLimiterDuration,
            tokenQuoteDecimal,
            activationType
        )

        // Test with a very large input amount to ensure we hit the maximum fee
        const inputAmount = new BN(1000000)
        const fee = calculateRateLimiterFee(params, inputAmount)

        // Calculate the maximum possible fee
        const maxFee = inputAmount
            .mul(new BN(MAX_FEE_NUMERATOR))
            .div(new BN(FEE_DENOMINATOR))

        // The actual fee should not exceed the maximum fee
        expect(fee.toNumber()).toBeLessThanOrEqual(maxFee.toNumber())
    })
})
