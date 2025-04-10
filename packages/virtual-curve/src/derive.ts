import { PublicKey } from '@solana/web3.js'
import { METADATA_PROGRAM_ID } from './constants'

const SEED = Object.freeze({
    POOL_AUTHORITY: 'pool_authority',
    POOL: 'pool',
    TOKEN_VAULT: 'token_vault',
    METADATA: 'metadata',
    EVENT_AUTHORITY: '__event_authority',
})

export function deriveEventAuthority(programId: PublicKey): PublicKey {
    const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.EVENT_AUTHORITY)],
        programId
    )
    return eventAuthority
}

export function derivePoolAuthority(programId: PublicKey): PublicKey {
    const [poolAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.POOL_AUTHORITY)],
        programId
    )

    return poolAuthority
}

export function derivePool(
    quoteMint: PublicKey,
    baseMint: PublicKey,
    config: PublicKey,
    programId: PublicKey
): PublicKey {
    const isQuoteMintBiggerThanBaseMint =
        new PublicKey(quoteMint)
            .toBuffer()
            .compare(new Uint8Array(new PublicKey(baseMint).toBuffer())) > 0

    const [pool] = PublicKey.findProgramAddressSync(
        [
            Buffer.from(SEED.POOL),
            new PublicKey(config).toBuffer(),
            isQuoteMintBiggerThanBaseMint
                ? new PublicKey(quoteMint).toBuffer()
                : new PublicKey(baseMint).toBuffer(),
            isQuoteMintBiggerThanBaseMint
                ? new PublicKey(baseMint).toBuffer()
                : new PublicKey(quoteMint).toBuffer(),
        ],
        programId
    )

    return pool
}

export function deriveTokenVault(
    pool: PublicKey,
    mint: PublicKey,
    programId: PublicKey
): PublicKey {
    const [tokenVault] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.TOKEN_VAULT), mint.toBuffer(), pool.toBuffer()],
        programId
    )

    return tokenVault
}

export function deriveMetadata(mint: PublicKey): PublicKey {
    const [metadata] = PublicKey.findProgramAddressSync(
        [
            Buffer.from(SEED.METADATA),
            METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        METADATA_PROGRAM_ID
    )

    return metadata
}
