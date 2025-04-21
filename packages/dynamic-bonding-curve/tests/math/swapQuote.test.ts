import { test, expect } from 'bun:test'
import BN from 'bn.js'
import { type VirtualPool, type PoolConfig } from '../../src/types'
import { DEFAULT_POOL_CONFIG, DEFAULT_VIRTUAL_POOL } from '../utils/defaults'
import { swapQuote } from '../../src/math/swapQuote'
import {
    MAX_CURVE_POINT,
    MIN_SQRT_PRICE,
    MAX_SQRT_PRICE,
} from '../../src/constants'

/**
 * Convert a decimal string or BN to a u128 (simulating Rust's u128 behavior)
 */
function toU128(value: string | BN) {
    const bn = BN.isBN(value) ? value : new BN(value)
    const U128_MAX = new BN(1).shln(128).subn(1)
    return bn.and(U128_MAX)
}

/**
 * Perform a left shift on a value and wrap to u128
 */
function u128Shl(value: string | BN, bits: number) {
    const bn = BN.isBN(value) ? value : new BN(value)
    return toU128(bn.shln(bits))
}

/**
 * Create a test pool configuration with specified parameters
 */
function createTestPoolConfig(params: {
    sqrtStartPrice: BN
    collectFeeMode: number
    feeNumerator?: BN
}) {
    // Define curve points with increasing prices to ensure liquidity at all levels
    const curve = Array(MAX_CURVE_POINT)
        .fill(null)
        .map((_, i) => {
            // Create a range of prices from sqrtStartPrice to MAX_SQRT_PRICE
            const priceFactor = 1 + (i / MAX_CURVE_POINT) * 10; // Gradually increase price
            const sqrtPrice = params.sqrtStartPrice.mul(new BN(Math.floor(priceFactor * 100))).div(new BN(100));
            
            return {
                sqrtPrice: sqrtPrice,
                liquidity: new BN('10000000000000000000000000'), // Much larger liquidity to ensure non-zero output
            };
        });

    // Create test pool configuration
    const config: PoolConfig = {
        ...DEFAULT_POOL_CONFIG,
        sqrtStartPrice: params.sqrtStartPrice,
        migrationQuoteThreshold: new BN('50000000000'), // 50k USDC
        collectFeeMode: params.collectFeeMode,
        curve,
    }

    // Add fee configuration if provided
    if (params.feeNumerator) {
        config.poolFees = {
            ...DEFAULT_POOL_CONFIG.poolFees,
            baseFee: {
                ...DEFAULT_POOL_CONFIG.poolFees.baseFee,
                cliffFeeNumerator: params.feeNumerator,
                periodFrequency: new BN(0),
                reductionFactor: new BN(0),
                numberOfPeriod: 0,
                feeSchedulerMode: 0,
            },
        }
    }

    return config
}

/**
 * Create a virtual pool with the given configuration
 */
function createVirtualPool(config: PoolConfig): VirtualPool {
    return {
        ...DEFAULT_VIRTUAL_POOL,
        sqrtPrice: config.sqrtStartPrice,
        baseReserve: new BN('1000000000000000'),
        quoteReserve: new BN('1000000000'), // Much smaller than migrationQuoteThreshold
        volatilityTracker: {
            lastUpdateTimestamp: new BN(0),
            padding: [],
            sqrtPriceReference: new BN(0),
            volatilityAccumulator: new BN(0),
            volatilityReference: new BN(0),
        },
    }
}

test('swap quote test without fees', () => {
    const sqrtStartPrice = MIN_SQRT_PRICE.shln(32)

    // Create test pool configuration
    const config = createTestPoolConfig({
        sqrtStartPrice,
        collectFeeMode: 1, // OutputToken mode
    })

    // Create virtual pool state
    const virtualPool = createVirtualPool(config)

    // Test base to quote swap (which doesn't require full liquidity traversal)
    const amountIn = new BN('1000000000') // 1k USDC
    const result = swapQuote(
        virtualPool,
        config,
        true, // base to quote
        amountIn,
        false, // no referral
        new BN(0) // current point
    )

    // Verify the result is reasonable
    expect(result.amountOut.gt(new BN(0))).toBe(true)
    expect(result.fee.trading.isZero()).toBe(true)
    expect(result.fee.protocol.isZero()).toBe(true)
})

test('swap quote test with fees', () => {
    const sqrtStartPrice = MIN_SQRT_PRICE.shln(32)

    // Create test pool configuration with fees
    const config = createTestPoolConfig({
        sqrtStartPrice,
        collectFeeMode: 1, // OutputToken mode
        feeNumerator: new BN(2_500_000),
    })

    // Create virtual pool state
    const virtualPool = createVirtualPool(config)

    // Test base to quote swap (which doesn't require full liquidity traversal)
    const amountIn = new BN('1000000000') // 1k USDC
    const result = swapQuote(
        virtualPool,
        config,
        true, // base to quote
        amountIn,
        false, // no referral
        new BN(0) // current point
    )

    // Verify the result has fees
    expect(result.amountOut.gt(new BN(0))).toBe(true)
    expect(result.fee.trading.gt(new BN(0))).toBe(true)

    // Test with small amount
    const smallAmountIn = new BN('1') // 1
    const smallResult = swapQuote(
        virtualPool,
        config,
        true, // base to quote
        smallAmountIn,
        false, // no referral
        new BN(0) // current point
    )

    // Small amount should still produce reasonable results
    expect(smallResult.amountOut.gte(new BN(0))).toBe(true)
})

test('swap quote with referral', () => {
    const sqrtStartPrice = MIN_SQRT_PRICE.shln(32)

    // Create test pool configuration with fees
    const config = createTestPoolConfig({
        sqrtStartPrice,
        collectFeeMode: 1, // OutputToken mode
        feeNumerator: new BN(2_500_000),
    })

    // Set referral fee percent
    config.poolFees.referralFeePercent = 20 // 20%
    config.poolFees.protocolFeePercent = 20 // 20%

    // Create virtual pool state
    const virtualPool = createVirtualPool(config)

    // Test base to quote swap (which doesn't require full liquidity traversal)
    const amountIn = new BN('1000000000') // 1k USDC
    const result = swapQuote(
        virtualPool,
        config,
        true, // base to quote
        amountIn,
        true, // with referral
        new BN(0) // current point
    )

    // Verify referral fee is calculated
    expect(result.fee.referral).toBeDefined()
    expect(result.fee.referral?.gt(new BN(0))).toBe(true)

    // Protocol fee should be reduced by referral fee
    expect(result.fee.protocol.gt(new BN(0))).toBe(true)
})

test('swap quote error cases', () => {
    const sqrtStartPrice = MIN_SQRT_PRICE.shln(32)

    // Create test pool configuration
    const config = createTestPoolConfig({
        sqrtStartPrice,
        collectFeeMode: 1, // OutputToken mode
    })

    // Create virtual pool state with completed migration
    const completedPool: VirtualPool = {
        ...createVirtualPool(config),
        quoteReserve: config.migrationQuoteThreshold,
    }

    // Test should throw for completed pool
    expect(() =>
        swapQuote(completedPool, config, false, new BN(1000), false, new BN(0))
    ).toThrow('Virtual pool is completed')

    // Test should throw for zero amount
    expect(() =>
        swapQuote(
            createVirtualPool(config),
            config,
            false,
            new BN(0),
            false,
            new BN(0)
        )
    ).toThrow('Amount is zero')
    
    // Test should throw for not enough liquidity
    expect(() =>
        swapQuote(
            createVirtualPool(config),
            config,
            false, // quote to base (which requires traversing the full curve)
            new BN('1000000000000000000000'), // Extremely large amount
            false,
            new BN(0)
        )
    ).toThrow('Not enough liquidity to process the entire amount')
})
