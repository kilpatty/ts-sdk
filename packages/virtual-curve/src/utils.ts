import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import { AccountLayout } from '@solana/spl-token'
import {
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    type Connection,
    type GetProgramAccountsFilter,
} from '@solana/web3.js'
import Idl from './idl/virtual-curve/idl.json'
import type { VirtualCurve } from './idl/virtual-curve/idl'
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createCloseAccountInstruction,
    getAssociatedTokenAddressSync,
    NATIVE_MINT,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

/**
 * Create a program instance
 * @param connection - The connection to the network
 * @returns The program instance
 */
export function createProgram(connection: Connection) {
    const provider = new AnchorProvider(connection, null as unknown as Wallet, {
        commitment: 'confirmed',
    })
    const program = new Program<VirtualCurve>(Idl, provider)

    return { provider, program }
}

/**
 * Find the associated token address for a wallet and token mint
 * @param walletAddress - The wallet address
 * @param tokenMintAddress - The token mint address
 * @param tokenProgramId - The token program ID
 * @returns The associated token address
 */
export function findAssociatedTokenAddress(
    walletAddress: PublicKey,
    tokenMintAddress: PublicKey,
    tokenProgramId: PublicKey
): PublicKey {
    return PublicKey.findProgramAddressSync(
        [
            walletAddress.toBuffer(),
            tokenProgramId.toBuffer(),
            tokenMintAddress.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )[0]
}

/**
 * Create a wrap SOL instruction
 * @param from - The from address
 * @param to - The to address
 * @param amount - The amount to wrap
 * @returns The wrap SOL instruction
 */
export function wrapSOLInstruction(
    from: PublicKey,
    to: PublicKey,
    amount: bigint
): TransactionInstruction[] {
    return [
        SystemProgram.transfer({
            fromPubkey: from,
            toPubkey: to,
            lamports: amount,
        }),
        new TransactionInstruction({
            keys: [
                {
                    pubkey: to,
                    isSigner: false,
                    isWritable: true,
                },
            ],
            data: Buffer.from(new Uint8Array([17])),
            programId: TOKEN_PROGRAM_ID,
        }),
    ]
}

/**
 * Create an unwrap SOL instruction
 * @param owner - The owner of the SOL
 * @param allowOwnerOffCurve - Whether to allow the owner to be off curve
 * @returns The unwrap SOL instruction
 */
export function unwrapSOLInstruction(
    owner: PublicKey,
    allowOwnerOffCurve = true
): TransactionInstruction | null {
    const wSolATAAccount = getAssociatedTokenAddressSync(
        NATIVE_MINT,
        owner,
        allowOwnerOffCurve
    )
    if (wSolATAAccount) {
        const closedWrappedSolInstruction = createCloseAccountInstruction(
            wSolATAAccount,
            owner,
            owner,
            [],
            TOKEN_PROGRAM_ID
        )
        return closedWrappedSolInstruction
    }
    return null
}

/**
 * Get the first key
 * @param key1 - The first key
 * @param key2 - The second key
 * @returns The first key
 */
export function getFirstKey(key1: PublicKey, key2: PublicKey) {
    const buf1 = key1.toBuffer()
    const buf2 = key2.toBuffer()
    // Buf1 > buf2
    if (Buffer.compare(buf1, buf2) === 1) {
        return buf1
    }
    return buf2
}

/**
 * Get the second key
 * @param key1 - The first key
 * @param key2 - The second key
 * @returns The second key
 */
export function getSecondKey(key1: PublicKey, key2: PublicKey) {
    const buf1 = key1.toBuffer()
    const buf2 = key2.toBuffer()
    // Buf1 > buf2
    if (Buffer.compare(buf1, buf2) === 1) {
        return buf2
    }
    return buf1
}

/**
 * Get token account information
 * @param connection - The connection to the Solana network
 * @param key - The token account public key
 * @returns The token account state or null if account doesn't exist
 */
export async function getTokenAccount(connection: Connection, key: PublicKey) {
    const accountInfo = await connection.getAccountInfo(key)
    if (!accountInfo) {
        return null
    }
    const tokenAccountState = AccountLayout.decode(accountInfo.data)
    return tokenAccountState
}

/**
 * Create a memcmp filter for owner-based filtering
 * @param owner - The owner public key or string
 * @param offset - The offset where the owner field is located in the account data
 * @returns A GetProgramAccountsFilter array with the owner filter
 */
export function createProgramAccountFilter(
    owner: PublicKey | string,
    offset: number
): GetProgramAccountsFilter[] {
    const ownerKey = typeof owner === 'string' ? new PublicKey(owner) : owner
    return [
        {
            memcmp: {
                offset,
                bytes: ownerKey.toBase58(),
                encoding: 'base58',
            },
        },
    ]
}
