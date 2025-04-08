import BN from 'bn.js'
import { SafeMath } from './safeMath'
import { Rounding, mulDiv } from './utilsMath'
import { RESOLUTION } from './constants'

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
    const numerator1 = liquidity
    const numerator2 = SafeMath.sub(upperSqrtPrice, lowerSqrtPrice)
    const denominator = SafeMath.mul(lowerSqrtPrice, upperSqrtPrice)

    if (denominator.isZero()) {
        throw new Error('Denominator cannot be zero')
    }

    return mulDiv(numerator1, numerator2, denominator, round)
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
    const prod = SafeMath.mul(
        liquidity,
        SafeMath.sub(upperSqrtPrice, lowerSqrtPrice)
    )

    if (round === Rounding.Up) {
        const denominator = new BN(1).shln(RESOLUTION * 2)
        // Ceiling division
        return SafeMath.add(
            SafeMath.div(prod, denominator),
            prod.mod(denominator).isZero() ? new BN(0) : new BN(1)
        )
    } else {
        return SafeMath.shr(prod, RESOLUTION * 2)
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
 * Gets the next sqrt price √P' given a delta of token_a
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
    if (amount.isZero()) {
        return sqrtPrice
    }

    const product = SafeMath.mul(amount, sqrtPrice)
    const denominator = SafeMath.add(liquidity, product)

    return mulDiv(liquidity, sqrtPrice, denominator, Rounding.Up)
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
    const quotient = SafeMath.div(
        SafeMath.shl(amount, RESOLUTION * 2),
        liquidity
    )

    return SafeMath.add(sqrtPrice, quotient)
}

/**
 * Gets the initial liquidity from delta quote
 * Formula: L = Δb / (√P_upper - √P_lower)
 * @param quoteAmount Quote amount
 * @param sqrtMinPrice Minimum sqrt price
 * @param sqrtPrice Current sqrt price
 * @returns Initial liquidity
 */
export function getInitialLiquidityFromDeltaQuote(
    quoteAmount: BN,
    sqrtMinPrice: BN,
    sqrtPrice: BN
): BN {
    const priceDelta = SafeMath.sub(sqrtPrice, sqrtMinPrice)
    const quoteAmountShifted = SafeMath.shl(quoteAmount, 128)

    return SafeMath.div(quoteAmountShifted, priceDelta)
}

/**
 * Gets the initialize amounts
 * @param sqrtMinPrice Minimum sqrt price
 * @param sqrtMaxPrice Maximum sqrt price
 * @param sqrtPrice Current sqrt price
 * @param liquidity Liquidity
 * @returns [base amount, quote amount]
 */
export function getInitializeAmounts(
    sqrtMinPrice: BN,
    sqrtMaxPrice: BN,
    sqrtPrice: BN,
    liquidity: BN
): [BN, BN] {
    // BASE TOKEN
    const amountBase = getDeltaAmountBaseUnsigned(
        sqrtPrice,
        sqrtMaxPrice,
        liquidity,
        Rounding.Up
    )

    // QUOTE TOKEN
    const amountQuote = getDeltaAmountQuoteUnsigned(
        sqrtMinPrice,
        sqrtPrice,
        liquidity,
        Rounding.Up
    )

    return [amountBase, amountQuote]
}
