import { PublicKey } from '@solana/web3.js'
import {
    DAMM_V2_PROGRAM_ID,
    METAPLEX_PROGRAM_ID,
    VIRTUAL_CURVE_PROGRAM_ID,
} from './constants'

const SEED = Object.freeze({
    POOL_AUTHORITY: 'pool_authority',
    EVENT_AUTHORITY: '__event_authority',
    POOL: 'pool',
    TOKEN_VAULT: 'token_vault',
    METADATA: 'metadata',
    PARTNER_METADATA: 'partner_metadata',
    CLAIM_FEE_OPERATOR: 'cf_operator',
    DAMM_V1_MIGRATION_METADATA: 'meteora',
    DAMM_V2_MIGRATION_METADATA: 'damm_v2',
    LP_MINT: 'lp_mint',
    FEE: 'fee',
    POSITION: 'position',
    POSITION_NFT_ACCOUNT: 'position_nft_account',
    LOCK_ESCROW: 'lock_escrow',
    VIRTUAL_POOL_METADATA: 'virtual_pool_metadata',
})

/**
 * Derive the event authority
 * @returns The event authority
 */
export function deriveEventAuthority(): PublicKey {
    const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.EVENT_AUTHORITY)],
        VIRTUAL_CURVE_PROGRAM_ID
    )
    return eventAuthority
}

/**
 * Derive the pool authority
 * @param programId - The program ID
 * @returns The pool authority
 */
export function derivePoolAuthority(programId: PublicKey): PublicKey {
    const [poolAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.POOL_AUTHORITY)],
        programId
    )

    return poolAuthority
}

/**
 * Derive the pool
 * @param quoteMint - The quote mint
 * @param baseMint - The base mint
 * @param config - The config
 * @param programId - The program ID
 * @returns The pool
 */
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

/**
 * Derive the token vault
 * @param pool - The pool
 * @param mint - The mint
 * @param programId - The program ID
 * @returns The token vault
 */
export function deriveTokenVaultAddress(
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

/**
 * Derive the metadata
 * @param mint - The mint
 * @returns The metadata
 */
export function deriveMetadata(mint: PublicKey): PublicKey {
    const [metadata] = PublicKey.findProgramAddressSync(
        [
            Buffer.from(SEED.METADATA),
            METAPLEX_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        METAPLEX_PROGRAM_ID
    )

    return metadata
}

/**
 * Derive the partner metadata
 * @param feeClaimer - The fee claimer
 * @param programId - The program ID
 * @returns The partner metadata
 */
export function derivePartnerMetadata(
    feeClaimer: PublicKey,
    programId: PublicKey
): PublicKey {
    const [partnerMetadata] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.PARTNER_METADATA), feeClaimer.toBuffer()],
        programId
    )
    return partnerMetadata
}

/**
 * Derive the virtual pool metadata
 * @param pool - The pool
 * @returns The virtual pool metadata
 */
export function deriveVirtualPoolMetadata(pool: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.VIRTUAL_POOL_METADATA), pool.toBuffer()],
        VIRTUAL_CURVE_PROGRAM_ID
    )[0]
}

/**
 * Derive the DAMM migration metadata address
 * @param virtual_pool - The virtual pool
 * @param programId - The program ID
 * @param migrateToDammV2 - Whether to migrate to DAMM V2
 * @returns The DAMM migration metadata address
 */
export function deriveDammMigrationMetadataAddress(
    virtual_pool: PublicKey,
    programId: PublicKey,
    migrateToDammV2: boolean
): PublicKey {
    if (migrateToDammV2) {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from(SEED.DAMM_V2_MIGRATION_METADATA),
                virtual_pool.toBuffer(),
            ],
            programId
        )[0]
    } else {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from(SEED.DAMM_V1_MIGRATION_METADATA),
                virtual_pool.toBuffer(),
            ],
            programId
        )[0]
    }
}

/**
 * Derive the LP mint address
 * @param pool - The pool
 * @param programId - The program ID
 * @returns The LP mint address
 */
export function deriveLpMintAddress(pool: PublicKey, programId: PublicKey) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.LP_MINT), pool.toBuffer()],
        programId
    )[0]
}

/**
 * Derive the protocol fee address
 * @param mint - The mint
 * @param pool - The pool
 * @param programId - The program ID
 * @returns The protocol fee address
 */
export function deriveProtocolFeeAddress(
    mint: PublicKey,
    pool: PublicKey,
    programId: PublicKey
) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.FEE), mint.toBuffer(), pool.toBuffer()],
        programId
    )[0]
}

/**
 * Derive the position address
 * @param positionNft - The position NFT
 * @returns The position address
 */
export function derivePositionAddress(
    positionNft: PublicKey,
    programId: PublicKey
): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.POSITION), positionNft.toBuffer()],
        programId
    )[0]
}

/**
 * Derive the position NFT account
 * @param positionNftMint - The position NFT mint
 * @returns The position NFT account
 */
export function derivePositionNftAccount(
    positionNftMint: PublicKey,
    programId: PublicKey
): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.POSITION_NFT_ACCOUNT), positionNftMint.toBuffer()],
        programId
    )[0]
}

/**
 * Derive the vault LP address
 * @param vault - The vault
 * @param pool - The pool
 * @param programId - The program ID
 * @returns The vault LP address
 */
export function deriveVaultLPAddress(
    vault: PublicKey,
    pool: PublicKey,
    programId: PublicKey
): PublicKey {
    return PublicKey.findProgramAddressSync(
        [vault.toBuffer(), pool.toBuffer()],
        programId
    )[0]
}

/**
 * Derive the lock escrow address
 * @param dammPool - The DAMM pool
 * @param creator - The creator of the virtual pool
 * @param programId - The program ID
 * @returns The lock escrow address
 */
export function deriveLockEscrowAddress(
    dammPool: PublicKey,
    creator: PublicKey,
    programId: PublicKey
): PublicKey {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from(SEED.LOCK_ESCROW),
            dammPool.toBuffer(),
            creator.toBuffer(),
        ],
        programId
    )[0]
}

/**
 * Derive the DAMM V2 event authority
 * @returns The event authority
 */
export function deriveDammV2EventAuthority(): PublicKey {
    const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED.EVENT_AUTHORITY)],
        DAMM_V2_PROGRAM_ID
    )
    return eventAuthority
}
