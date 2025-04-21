import BN from 'bn.js'
import Decimal from 'decimal.js'
import { decimalToBN, batchBnToDecimal } from './utilsMath'
import { RESOLUTION } from '../constants'
import { Rounding } from '../types'

/**
 * Gets the delta amount_base for given liquidity and price range
 * Formula: Δa = L * (1 / √P_lower - 1 / √P_upper)
 * i.e. L * (√P_upper - √P_lower) / (√P_upper * √P_lower)
 * @param lowerSqrtPrice Lower sqrt price
 * @param upperSqrtPrice Upper sqrt price
 * @param liquidity Liquidity
 * @param round Rounding direction
 * @returns Delta amount base
 */
export function getDeltaAmountBaseUnsigned(
    lowerSqrtPrice: BN,
    upperSqrtPrice: BN,
    liquidity: BN,
    round: Rounding
): BN {
    // Skip calculation for zero liquidity
    if (liquidity.isZero()) {
        return new BN(0)
    }

    // Convert to Decimal for higher precision in one batch
    const [lowerSqrtPriceDecimal, upperSqrtPriceDecimal, liquidityDecimal] =
        batchBnToDecimal(lowerSqrtPrice, upperSqrtPrice, liquidity)

    // Batch operations in Decimal
    const numerator = upperSqrtPriceDecimal
        ? upperSqrtPriceDecimal.sub(lowerSqrtPriceDecimal ?? new Decimal(0))
        : new Decimal(0)
    const denominator = lowerSqrtPriceDecimal
        ? lowerSqrtPriceDecimal.mul(upperSqrtPriceDecimal ?? new Decimal(0))
        : new Decimal(0)

    if (denominator.isZero()) {
        throw new Error('Denominator cannot be zero')
    }

    // Calculate with Decimal.js in one operation
    const result = liquidityDecimal
        ? liquidityDecimal.mul(numerator).div(denominator)
        : new Decimal(0)

    // Convert back to BN with appropriate rounding
    return decimalToBN(result, round)
}

/**
 * Gets the delta amount_quote for given liquidity and price range
 * Formula: Δb = L (√P_upper - √P_lower)
 * @param lowerSqrtPrice Lower sqrt price
 * @param upperSqrtPrice Upper sqrt price
 * @param liquidity Liquidity
 * @param round Rounding direction
 * @returns Delta amount quote
 */
export function getDeltaAmountQuoteUnsigned(
    lowerSqrtPrice: BN,
    upperSqrtPrice: BN,
    liquidity: BN,
    round: Rounding
): BN {
    // Skip calculation for zero liquidity
    if (liquidity.isZero()) {
        return new BN(0)
    }

    try {
        // Convert to Decimal for higher precision in one batch
        const [lowerSqrtPriceDecimal, upperSqrtPriceDecimal, liquidityDecimal] =
            batchBnToDecimal(lowerSqrtPrice, upperSqrtPrice, liquidity)

        // Validate inputs
        if (
            !lowerSqrtPriceDecimal ||
            !upperSqrtPriceDecimal ||
            !liquidityDecimal
        ) {
            throw new Error('Failed to convert BN to Decimal')
        }

        // Batch operations in Decimal
        const deltaSqrtPrice = upperSqrtPriceDecimal.sub(lowerSqrtPriceDecimal)
        const denominator = new Decimal(2).pow(RESOLUTION * 2)

        // Calculate with Decimal.js in one operation
        const result = liquidityDecimal.mul(deltaSqrtPrice).div(denominator)

        // Validate result
        if (!result.isFinite()) {
            throw new Error('Invalid calculation result: not finite')
        }

        // Convert back to BN with appropriate rounding
        return decimalToBN(result, round)
    } catch (error: unknown) {
        console.error('Error in getDeltaAmountQuoteUnsigned:', {
            lowerSqrtPrice: lowerSqrtPrice.toString(),
            upperSqrtPrice: upperSqrtPrice.toString(),
            liquidity: liquidity.toString(),
            error: error instanceof Error ? error.message : String(error),
        })
        throw error
    }
}

/**
 * Gets the next sqrt price given an input amount of token_a or token_b
 * @param sqrtPrice Current sqrt price
 * @param liquidity Liquidity
 * @param amountIn Input amount
 * @param baseForQuote Whether the input is base token for quote token
 * @returns Next sqrt price
 */
export function getNextSqrtPriceFromInput(
    sqrtPrice: BN,
    liquidity: BN,
    amountIn: BN,
    baseForQuote: boolean
): BN {
    if (sqrtPrice.isZero() || liquidity.isZero()) {
        throw new Error('Price or liquidity cannot be zero')
    }

    // Round off to make sure that we don't pass the target price
    if (baseForQuote) {
        return getNextSqrtPriceFromAmountBaseRoundingUp(
            sqrtPrice,
            liquidity,
            amountIn
        )
    } else {
        return getNextSqrtPriceFromAmountQuoteRoundingDown(
            sqrtPrice,
            liquidity,
            amountIn
        )
    }
}

/**
 * Gets the next sqrt price from amount base rounding up
 * Formula: √P' = √P * L / (L + Δx * √P)
 * @param sqrtPrice Current sqrt price
 * @param liquidity Liquidity
 * @param amount Input amount
 * @returns Next sqrt price
 */
export function getNextSqrtPriceFromAmountBaseRoundingUp(
    sqrtPrice: BN,
    liquidity: BN,
    amount: BN
): BN {
    // Early return for zero amount
    if (amount.isZero()) {
        return sqrtPrice
    }

    // Convert to Decimal for higher precision in one batch
    const [sqrtPriceDecimal, liquidityDecimal, amountDecimal] =
        batchBnToDecimal(sqrtPrice, liquidity, amount)

    // Batch operations in Decimal
    const product = amountDecimal
        ? amountDecimal.mul(sqrtPriceDecimal ?? new Decimal(0))
        : new Decimal(0)
    const denominator = liquidityDecimal
        ? liquidityDecimal.add(product)
        : new Decimal(0)

    // Calculate with Decimal.js in one operation
    const result = liquidityDecimal
        ? liquidityDecimal
              .mul(sqrtPriceDecimal ?? new Decimal(0))
              .div(denominator)
        : new Decimal(0)

    // Convert back to BN with ceiling rounding
    return decimalToBN(result, Rounding.Up)
}

/**
 * Gets the next sqrt price given a delta of token_quote
 * Formula: √P' = √P + Δy / L
 * @param sqrtPrice Current sqrt price
 * @param liquidity Liquidity
 * @param amount Input amount
 * @returns Next sqrt price
 */
export function getNextSqrtPriceFromAmountQuoteRoundingDown(
    sqrtPrice: BN,
    liquidity: BN,
    amount: BN
): BN {
    // Early return for zero amount
    if (amount.isZero()) {
        return sqrtPrice
    }

    // Convert to Decimal for higher precision in one batch
    const [sqrtPriceDecimal, liquidityDecimal, amountDecimal] =
        batchBnToDecimal(sqrtPrice, liquidity, amount)

    // Batch operations in Decimal
    const scaleFactor = new Decimal(2).pow(RESOLUTION * 2)

    // Calculate with Decimal.js in one operation
    const result = sqrtPriceDecimal
        ? sqrtPriceDecimal.add(
              amountDecimal
                  ? amountDecimal
                        .mul(scaleFactor)
                        .div(liquidityDecimal ?? new Decimal(0))
                  : new Decimal(0)
          )
        : new Decimal(0)

    // Convert back to BN with floor rounding
    return decimalToBN(result, Rounding.Down)
}
