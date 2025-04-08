import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import {
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    type Connection,
} from '@solana/web3.js'
import Idl from './idl/idl.json'
import type { VirtualCurve } from './idl/idl'
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createCloseAccountInstruction,
    getAssociatedTokenAddressSync,
    NATIVE_MINT,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

export function createProgram(connection: Connection) {
    const provider = new AnchorProvider(connection, null as unknown as Wallet, {
        commitment: 'confirmed',
    })
    const program = new Program<VirtualCurve>(Idl, provider)

    return { provider, program }
}

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
