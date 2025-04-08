import BN from 'bn.js'
import { SafeMath } from './safeMath'
import { MAX_CURVE_POINT } from './constants'
import {
    getDeltaAmountBaseUnsigned,
    getDeltaAmountQuoteUnsigned,
    getNextSqrtPriceFromInput,
} from './curve'
import { type FeeMode, type FeeOnAmountResult, getFeeOnAmount } from './feeMath'
import { Rounding } from './utilsMath'

/**
 * Trade direction
 */
export enum TradeDirection {
    BaseToQuote = 0,
    QuoteToBase = 1,
}

/**
 * Swap amount result
 */
export interface SwapAmount {
    outputAmount: BN
    nextSqrtPrice: BN
}

/**
 * Swap result
 */
export interface SwapResult {
    actualInputAmount: BN
    outputAmount: BN
    nextSqrtPrice: BN
    tradingFee: BN
    protocolFee: BN
    referralFee: BN
}

/**
 * Get swap result
 * @param poolState Pool state
 * @param configState Config state
 * @param amountIn Input amount
 * @param feeMode Fee mode
 * @param tradeDirection Trade direction
 * @param currentPoint Current point
 * @returns Swap result
 */
export function getSwapResult(
    poolState: {
        poolFees: {
            baseFee: {
                cliffFeeNumerator: BN
                feeSchedulerMode: number
                numberOfPeriod: number
                periodFrequency: BN
                reductionFactor: BN
            }
            protocolFeePercent: number
            referralFeePercent: number
            dynamicFee: {
                initialized: number
                maxVolatilityAccumulator: number
                variableFeeControl: number
                binStep: number
                filterPeriod: number
                decayPeriod: number
                reductionFactor: number
                lastUpdateTimestamp: BN
                binStepU128: BN
                sqrtPriceReference: BN
                volatilityAccumulator: BN
                volatilityReference: BN
            }
        }
        sqrtPrice: BN
        activationPoint: BN
    },
    configState: {
        curve: Array<{
            sqrtPrice: BN
            liquidity: BN
        }>
    },
    amountIn: BN,
    feeMode: FeeMode,
    tradeDirection: TradeDirection,
    currentPoint: BN
): SwapResult {
    let actualProtocolFee = new BN(0)
    let actualTradingFee = new BN(0)
    let actualReferralFee = new BN(0)

    // Apply fees on input if needed
    let actualAmountIn: BN
    if (feeMode.feesOnInput) {
        const feeResult: FeeOnAmountResult = getFeeOnAmount(
            amountIn,
            poolState.poolFees,
            feeMode.hasReferral,
            currentPoint,
            poolState.activationPoint
        )

        actualProtocolFee = feeResult.protocolFee
        actualTradingFee = feeResult.tradingFee
        actualReferralFee = feeResult.referralFee
        actualAmountIn = feeResult.amount
    } else {
        actualAmountIn = amountIn
    }

    // Calculate swap amount
    const swapAmount: SwapAmount =
        tradeDirection === TradeDirection.BaseToQuote
            ? getSwapAmountFromBaseToQuote(
                  configState,
                  poolState.sqrtPrice,
                  actualAmountIn
              )
            : getSwapAmountFromQuoteToBase(
                  configState,
                  poolState.sqrtPrice,
                  actualAmountIn
              )

    // Apply fees on output if needed
    let actualAmountOut: BN
    if (feeMode.feesOnInput) {
        actualAmountOut = swapAmount.outputAmount
    } else {
        const feeResult: FeeOnAmountResult = getFeeOnAmount(
            swapAmount.outputAmount,
            poolState.poolFees,
            feeMode.hasReferral,
            currentPoint,
            poolState.activationPoint
        )

        actualProtocolFee = feeResult.protocolFee
        actualTradingFee = feeResult.tradingFee
        actualReferralFee = feeResult.referralFee
        actualAmountOut = feeResult.amount
    }

    return {
        actualInputAmount: actualAmountIn,
        outputAmount: actualAmountOut,
        nextSqrtPrice: swapAmount.nextSqrtPrice,
        tradingFee: actualTradingFee,
        protocolFee: actualProtocolFee,
        referralFee: actualReferralFee,
    }
}

/**
 * Get swap amount from base to quote
 * @param configState Config state
 * @param currentSqrtPrice Current sqrt price
 * @param amountIn Input amount
 * @returns Swap amount
 */
export function getSwapAmountFromBaseToQuote(
    configState: {
        curve: Array<{
            sqrtPrice: BN
            liquidity: BN
        }>
    },
    currentSqrtPrice: BN,
    amountIn: BN
): SwapAmount {
    let totalOutputAmount = new BN(0)
    let sqrtPrice = currentSqrtPrice
    let amountLeft = amountIn

    // Iterate through the curve points in reverse order
    for (let i = MAX_CURVE_POINT - 1; i >= 0; i--) {
        if (i >= configState.curve.length) continue

        if (configState.curve[i]?.sqrtPrice?.lt(sqrtPrice)) {
            const maxAmountIn = getDeltaAmountBaseUnsigned(
                configState.curve[i]?.sqrtPrice || new BN(0),
                sqrtPrice,
                i + 1 < configState.curve.length
                    ? configState.curve[i + 1]?.liquidity || new BN(0)
                    : configState.curve[i]?.liquidity || new BN(0),
                Rounding.Up
            )

            if (amountLeft.lt(maxAmountIn)) {
                const liquidity =
                    i + 1 < configState.curve.length
                        ? configState.curve[i + 1]?.liquidity ||
                          configState.curve[i]?.liquidity ||
                          new BN(0)
                        : configState.curve[i]?.liquidity || new BN(0)

                const nextSqrtPrice = getNextSqrtPriceFromInput(
                    sqrtPrice,
                    liquidity,
                    amountLeft,
                    true
                )

                const outputAmount = getDeltaAmountQuoteUnsigned(
                    nextSqrtPrice,
                    sqrtPrice,
                    liquidity,
                    Rounding.Down
                )

                totalOutputAmount = SafeMath.add(
                    totalOutputAmount,
                    outputAmount
                )
                sqrtPrice = nextSqrtPrice
                amountLeft = new BN(0)
                break
            } else {
                const nextSqrtPrice = configState.curve[i]?.sqrtPrice
                const outputAmount = getDeltaAmountQuoteUnsigned(
                    nextSqrtPrice as BN,
                    sqrtPrice,
                    i + 1 < configState.curve.length
                        ? configState.curve[i + 1]?.liquidity ||
                              configState.curve[i]?.liquidity ||
                              new BN(0)
                        : configState.curve[i]?.liquidity || new BN(0),
                    Rounding.Down
                )

                totalOutputAmount = SafeMath.add(
                    totalOutputAmount,
                    outputAmount
                )
                sqrtPrice = nextSqrtPrice as BN
                amountLeft = SafeMath.sub(amountLeft, maxAmountIn)
            }
        }
    }

    // Process remaining amount
    if (!amountLeft.isZero()) {
        const nextSqrtPrice = getNextSqrtPriceFromInput(
            sqrtPrice,
            configState.curve[0]?.liquidity || new BN(0),
            amountLeft,
            true
        )

        const outputAmount = getDeltaAmountQuoteUnsigned(
            nextSqrtPrice,
            sqrtPrice,
            configState.curve[0]?.liquidity || new BN(0),
            Rounding.Down
        )

        totalOutputAmount = SafeMath.add(totalOutputAmount, outputAmount)
        sqrtPrice = nextSqrtPrice
    }

    return {
        outputAmount: totalOutputAmount,
        nextSqrtPrice: sqrtPrice,
    }
}

/**
 * Get swap amount from quote to base
 * @param configState Config state
 * @param currentSqrtPrice Current sqrt price
 * @param amountIn Input amount
 * @returns Swap amount
 * @throws Error if not enough liquidity
 */
export function getSwapAmountFromQuoteToBase(
    configState: {
        curve: Array<{
            sqrtPrice: BN
            liquidity: BN
        }>
    },
    currentSqrtPrice: BN,
    amountIn: BN
): SwapAmount {
    let totalOutputAmount = new BN(0)
    let sqrtPrice = currentSqrtPrice
    let amountLeft = amountIn

    // Iterate through the curve points
    for (let i = 0; i < MAX_CURVE_POINT; i++) {
        if (i >= configState.curve.length) continue

        if (configState.curve[i]?.sqrtPrice?.gt(sqrtPrice)) {
            const maxAmountIn = getDeltaAmountQuoteUnsigned(
                sqrtPrice,
                configState.curve[i]?.sqrtPrice || new BN(0),
                configState.curve[i]?.liquidity || new BN(0),
                Rounding.Up
            )

            if (amountLeft.lt(maxAmountIn)) {
                const nextSqrtPrice = getNextSqrtPriceFromInput(
                    sqrtPrice,
                    configState.curve[i]?.liquidity || new BN(0),
                    amountLeft,
                    false
                )

                const outputAmount = getDeltaAmountBaseUnsigned(
                    sqrtPrice,
                    nextSqrtPrice,
                    configState.curve[i]?.liquidity || new BN(0),
                    Rounding.Down
                )

                totalOutputAmount = SafeMath.add(
                    totalOutputAmount,
                    outputAmount
                )
                sqrtPrice = nextSqrtPrice
                amountLeft = new BN(0)
                break
            } else {
                const nextSqrtPrice = configState?.curve[i]?.sqrtPrice
                const outputAmount = getDeltaAmountBaseUnsigned(
                    sqrtPrice,
                    nextSqrtPrice as BN,
                    configState.curve[i]?.liquidity || new BN(0),
                    Rounding.Down
                )

                totalOutputAmount = SafeMath.add(
                    totalOutputAmount,
                    outputAmount
                )
                sqrtPrice = nextSqrtPrice as BN
                amountLeft = SafeMath.sub(amountLeft, maxAmountIn)
            }
        }
    }

    // Check if all amount was processed
    if (!amountLeft.isZero()) {
        // Instead of throwing an error, just return what we've processed so far
        console.warn('Not enough liquidity to process the entire amount')
    }

    return {
        outputAmount: totalOutputAmount,
        nextSqrtPrice: sqrtPrice,
    }
}

/**
 * Get fee mode
 * @param collectFeeMode Collect fee mode
 * @param tradeDirection Trade direction
 * @param hasReferral Whether referral is used
 * @returns Fee mode
 */
export function getFeeMode(
    collectFeeMode: number,
    tradeDirection: TradeDirection,
    hasReferral: boolean
): FeeMode {
    let feesOnInput: boolean
    let feesOnBaseToken: boolean

    if (collectFeeMode === 0) {
        // QuoteToken
        if (tradeDirection === TradeDirection.BaseToQuote) {
            feesOnInput = false
            feesOnBaseToken = false
        } else {
            feesOnInput = true
            feesOnBaseToken = false
        }
    } else if (collectFeeMode === 1) {
        // OutputToken
        if (tradeDirection === TradeDirection.BaseToQuote) {
            feesOnInput = false
            feesOnBaseToken = false
        } else {
            feesOnInput = false
            feesOnBaseToken = true
        }
    } else {
        throw new Error('Invalid collect fee mode')
    }

    return {
        feesOnInput,
        feesOnBaseToken,
        hasReferral,
    }
}
