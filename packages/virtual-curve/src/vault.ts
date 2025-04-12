import {
    Connection,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionInstruction,
} from '@solana/web3.js'
import { VAULT_BASE_KEY } from './constants'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createVaultProgram } from './utils'

export async function createInitializePermissionlessDynamicVaultIx(
    mint: PublicKey,
    payer: PublicKey,
    connection: Connection
): Promise<{
    vaultKey: PublicKey
    tokenVaultKey: PublicKey
    lpMintKey: PublicKey
    instruction: TransactionInstruction
}> {
    const vaultProgram = createVaultProgram(connection)
    const vaultKey = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), mint.toBuffer(), VAULT_BASE_KEY.toBuffer()],
        vaultProgram.programId
    )[0]

    const tokenVaultKey = PublicKey.findProgramAddressSync(
        [Buffer.from('token_vault'), vaultKey.toBuffer()],
        vaultProgram.programId
    )[0]

    const lpMintKey = PublicKey.findProgramAddressSync(
        [Buffer.from('lp_mint'), vaultKey.toBuffer()],
        vaultProgram.programId
    )[0]

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
    connection: Connection,
    payer: PublicKey
): Promise<{
    vaultPda: PublicKey
    tokenVaultPda: PublicKey
    lpMintPda: PublicKey
    instruction?: TransactionInstruction
}> {
    const vaultIx = await createInitializePermissionlessDynamicVaultIx(
        mint,
        payer,
        connection
    )

    const vaultAccount = await connection.getAccountInfo(vaultIx.vaultKey)
    let instruction: TransactionInstruction | undefined

    if (!vaultAccount) {
        instruction = vaultIx.instruction
    }

    return {
        vaultPda: vaultIx.vaultKey,
        tokenVaultPda: vaultIx.tokenVaultKey,
        lpMintPda: vaultIx.lpMintKey,
        instruction,
    }
}
