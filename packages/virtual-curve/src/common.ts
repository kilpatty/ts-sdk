import {
    Connection,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionInstruction,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
    deriveLpMintAddress,
    deriveTokenVaultKey,
    deriveVaultAddress,
} from './derive'
import type { DynamicVault } from './idl/dynamic-vault/idl'
import type { Program } from '@coral-xyz/anchor'
import type { DammV1 } from './idl/damm-v1/idl'
import type {
    LiquidityDistributionParameters,
    PrepareSwapParams,
    TokenType,
} from './types'
import { getTokenProgram } from './utils'
import { BASE_ADDRESS } from './constants'
import BN from 'bn.js'
import Decimal from 'decimal.js'

/**
 * Create a permissionless dynamic vault
 * @param mint - The mint of the vault
 * @param payer - The payer of the vault
 * @param vaultProgram - The vault program
 * @returns The vault key, token vault key, and lp mint key
 */
export async function createInitializePermissionlessDynamicVaultIx(
    mint: PublicKey,
    payer: PublicKey,
    vaultProgram: Program<DynamicVault>
): Promise<{
    vaultKey: PublicKey
    tokenVaultKey: PublicKey
    lpMintKey: PublicKey
    instruction: TransactionInstruction
}> {
    const vaultKey = deriveVaultAddress(mint, BASE_ADDRESS)

    const tokenVaultKey = deriveTokenVaultKey(vaultKey)

    const lpMintKey = deriveLpMintAddress(vaultKey, vaultProgram.programId)

    const ix = await vaultProgram.methods
        .initialize()
        .accountsPartial({
            vault: vaultKey,
            tokenVault: tokenVaultKey,
            tokenMint: mint,
            lpMint: lpMintKey,
            payer,
            rent: SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .instruction()

    return {
        instruction: ix,
        vaultKey,
        tokenVaultKey,
        lpMintKey,
    }
}

/**
 * Create a lock escrow instruction
 * @param connection - The connection to the Solana network
 * @param payer - The payer of the lock escrow
 * @param pool - The pool address
 * @param lpMint - The lp mint address
 * @param escrowOwner - The owner of the escrow
 * @param lockEscrowKey - The lock escrow key
 * @param dammV1Program - The DAMM V1 program
 * @returns The lock escrow instruction
 */
export async function createLockEscrowIx(
    connection: Connection,
    payer: PublicKey,
    pool: PublicKey,
    lpMint: PublicKey,
    escrowOwner: PublicKey,
    lockEscrowKey: PublicKey,
    dammV1Program: Program<DammV1>
): Promise<TransactionInstruction> {
    const ix = await dammV1Program.methods
        .createLockEscrow()
        .accountsStrict({
            pool,
            lpMint,
            owner: escrowOwner,
            lockEscrow: lockEscrowKey,
            systemProgram: SystemProgram.programId,
            payer: payer,
        })
        .instruction()

    return ix
}

/**
 * Prepare swap parameters
 * @param swapBaseForQuote - Whether to swap base for quote
 * @param virtualPoolState - The virtual pool state
 * @param poolConfigState - The pool config state
 * @returns The prepare swap parameters
 */
export function prepareSwapParams(
    swapBaseForQuote: boolean,
    virtualPoolState: {
        baseMint: PublicKey
        poolType: TokenType
    },
    poolConfigState: {
        quoteMint: PublicKey
        quoteTokenFlag: TokenType
    }
): PrepareSwapParams {
    if (swapBaseForQuote) {
        return {
            inputMint: new PublicKey(virtualPoolState.baseMint),
            outputMint: new PublicKey(poolConfigState.quoteMint),
            inputTokenProgram: getTokenProgram(virtualPoolState.poolType),
            outputTokenProgram: getTokenProgram(poolConfigState.quoteTokenFlag),
        }
    } else {
        return {
            inputMint: new PublicKey(poolConfigState.quoteMint),
            outputMint: new PublicKey(virtualPoolState.baseMint),
            inputTokenProgram: getTokenProgram(poolConfigState.quoteTokenFlag),
            outputTokenProgram: getTokenProgram(virtualPoolState.poolType),
        }
    }
}

/**
 * Get the sqrt price from the price
 * @param price - The price
 * @param tokenADecimal - The decimal of token A
 * @param tokenBDecimal - The decimal of token B
 * @returns The sqrt price
 */
// Original formula: price = (sqrtPrice >> 64)^2 * 10^(tokenADecimal - tokenBDecimal)
export const getSqrtPriceFromPrice = (
    price: string,
    tokenADecimal: number,
    tokenBDecimal: number
): BN => {
    const decimalPrice = new Decimal(price)
    const adjustedByDecimals = decimalPrice.div(
        new Decimal(10 ** (tokenADecimal - tokenBDecimal))
    )
    const sqrtValue = Decimal.sqrt(adjustedByDecimals)
    const sqrtValueQ64 = sqrtValue.mul(Decimal.pow(2, 64))
    return new BN(sqrtValueQ64.floor().toFixed())
}

/**
 * Get the price from the sqrt price
 * @param sqrtPrice - The sqrt price
 * @param tokenADecimal - The decimal of token A
 * @param tokenBDecimal - The decimal of token B
 * @returns The price
 */
// Reverse formula: sqrtPrice = sqrt(price / 10^(tokenADecimal - tokenBDecimal)) << 64
export const getPriceFromSqrtPrice = (
    sqrtPrice: BN,
    tokenADecimal: number,
    tokenBDecimal: number
): Decimal => {
    const decimalSqrtPrice = new Decimal(sqrtPrice.toString())
    const price = decimalSqrtPrice
        .mul(decimalSqrtPrice)
        .mul(new Decimal(10 ** (tokenADecimal - tokenBDecimal)))
        .div(Decimal.pow(2, 128))

    return price
}

/**
 * Get the base token for swap
 * @param sqrtStartPrice - The start sqrt price
 * @param sqrtMigrationPrice - The migration sqrt price
 * @param curve - The curve
 * @returns The base token
 */
export function getBaseTokenForSwap(
    sqrtStartPrice: BN,
    sqrtMigrationPrice: BN,
    curve: Array<LiquidityDistributionParameters>
): BN {
    let totalAmount = new BN(0)
    for (let i = 0; i < curve.length; i++) {
        const lowerSqrtPrice = i == 0 ? sqrtStartPrice : curve[i - 1]?.sqrtPrice
        if (curve[i]?.sqrtPrice && curve[i]?.sqrtPrice.gt(sqrtMigrationPrice)) {
            const deltaAmount = getDeltaAmountBase(
                lowerSqrtPrice ?? new BN(0),
                sqrtMigrationPrice,
                curve[i]?.liquidity ?? new BN(0)
            )
            totalAmount = totalAmount.add(deltaAmount)
            break
        } else {
            const deltaAmount = getDeltaAmountBase(
                lowerSqrtPrice ?? new BN(0),
                curve[i]?.sqrtPrice ?? new BN(0),
                curve[i]?.liquidity ?? new BN(0)
            )
            totalAmount = totalAmount.add(deltaAmount)
        }
    }
    return totalAmount
}

/**
 * Get the base token for migration
 * @param sqrtMigrationPrice - The migration sqrt price
 * @param migrationQuoteThreshold - The migration quote threshold
 * @returns The base token
 */
export function getBaseTokenForMigration(
    sqrtMigrationPrice: BN,
    migrationQuoteThreshold: BN
): BN {
    const price = sqrtMigrationPrice.mul(sqrtMigrationPrice)
    const base = migrationQuoteThreshold.shln(128).div(price)
    return base
}

/**
 * Get the delta amount base
 * @param lowerSqrtPrice - The lower sqrt price
 * @param upperSqrtPrice - The upper sqrt price
 * @param liquidity - The liquidity
 * @returns The delta amount base
 */
export function getDeltaAmountBase(
    lowerSqrtPrice: BN,
    upperSqrtPrice: BN,
    liquidity: BN
): BN {
    const numerator = liquidity.mul(upperSqrtPrice.sub(lowerSqrtPrice))
    const denominator = lowerSqrtPrice.mul(upperSqrtPrice)
    return numerator.add(denominator).sub(new BN(1)).div(denominator)
}
