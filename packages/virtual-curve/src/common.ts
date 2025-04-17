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
import type { PrepareSwapParams, TokenType } from './types'
import { getTokenProgram } from './utils'
import { BASE_ADDRESS } from './constants'

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
 * Create a vault if it doesn't exist
 * @param mint - The mint of the vault
 * @param vaultProgram - The vault program
 * @param payer - The payer of the vault
 * @param connection - The connection to the Solana network
 * @returns The vault key, token vault key, and lp mint key
 */
export async function createVaultIfNotExists(
    mint: PublicKey,
    vaultProgram: Program<DynamicVault>,
    payer: PublicKey,
    connection: Connection
): Promise<{
    vaultPda: PublicKey
    tokenVaultPda: PublicKey
    lpMintPda: PublicKey
    ix?: TransactionInstruction
}> {
    const vaultIx = await createInitializePermissionlessDynamicVaultIx(
        mint,
        payer,
        vaultProgram
    )

    console.log('vaultIx:', vaultIx)

    return {
        vaultPda: vaultIx.vaultKey,
        tokenVaultPda: vaultIx.tokenVaultKey,
        lpMintPda: vaultIx.lpMintKey,
        ix: vaultIx.instruction,
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
