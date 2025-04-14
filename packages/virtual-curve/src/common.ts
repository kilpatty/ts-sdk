import {
    Connection,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionInstruction,
} from '@solana/web3.js'
import { VAULT_BASE_KEY } from './constants'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { deriveLpMintAddress } from './derive'
import type { DynamicVault } from './idl/dynamic-vault/idl'
import type { Program } from '@coral-xyz/anchor'
import type { DammV1 } from './idl/damm-v1/idl'

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
    const vaultKey = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), mint.toBuffer(), VAULT_BASE_KEY.toBuffer()],
        vaultProgram.programId
    )[0]

    const tokenVaultKey = PublicKey.findProgramAddressSync(
        [Buffer.from('token_vault'), vaultKey.toBuffer()],
        vaultProgram.programId
    )[0]

    const lpMintKey = deriveLpMintAddress(vaultKey, vaultProgram.programId)

    const ix = await vaultProgram.methods
        .initialize()
        .accountsStrict({
            vault: vaultKey,
            tokenVault: tokenVaultKey,
            payer,
            tokenMint: mint,
            lpMint: lpMintKey,
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

    const vaultAccount = await connection.getAccountInfo(vaultIx.vaultKey)
    let ix: TransactionInstruction | undefined

    if (!vaultAccount) {
        ix = vaultIx.instruction
    }

    return {
        vaultPda: vaultIx.vaultKey,
        tokenVaultPda: vaultIx.tokenVaultKey,
        lpMintPda: vaultIx.lpMintKey,
        ix,
    }
}

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
