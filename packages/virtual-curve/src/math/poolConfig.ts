import BN from 'bn.js'
import type { PoolConfig } from '../types'
import { MAX_TOKEN_SUPPLY } from '../constants'

/**
 * Calculate total amount with buffer (matches Rust's total_amount_with_buffer)
 */
export function calculateTotalAmountWithBuffer(
    swapBaseAmount: BN,
    migrationBaseThreshold: BN
): BN {
    const totalAmount = migrationBaseThreshold.add(swapBaseAmount)
    // 5 * totalAmount / 4 (adds 25% buffer)
    return totalAmount.mul(new BN(5)).div(new BN(4))
}

/**
 * Calculate max supply based on token decimals (matches Rust's get_max_supply)
 */
export function getMaxSupply(tokenDecimal: number): BN {
    const decimalMultiplier = new BN(10).pow(new BN(tokenDecimal))
    return decimalMultiplier.mul(MAX_TOKEN_SUPPLY)
}

/**
 * Get initial base supply (matches Rust's get_initial_base_supply)
 */
export function getInitialBaseSupply(config: PoolConfig): BN {
    return calculateTotalAmountWithBuffer(
        config.swapBaseAmount,
        config.migrationBaseThreshold
    )
}

/**
 * Check if pool is curve complete (matches Rust's is_curve_complete)
 */
export function isCurveComplete(
    config: PoolConfig,
    poolQuoteReserve: BN
): boolean {
    return poolQuoteReserve.gte(config.migrationQuoteThreshold)
}
