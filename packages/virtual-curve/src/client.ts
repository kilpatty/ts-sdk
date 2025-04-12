import {
    TokenType,
    type ClaimTradingFeeParam,
    type CreateConfigParam,
    type CreateDammMigrationMetadataParam,
    type CreatePartnerMetadataParam,
    type CreatePartnerMetadataParameters,
    type CreatePoolParam,
    type InitializeVirtualPoolWithSplTokenAccounts,
    type InitializeVirtualPoolWithToken2022Accounts,
    type DammLpTokenParam,
    type MeteoraDammMigrationMetadata,
    type MigrateToDammParam,
    type PartnerWithdrawSurplusParam,
    type PoolConfig,
    type PoolConfigState,
    type SwapAccounts,
    type SwapParam,
    type VirtualCurveClientInterface,
    type VirtualPool,
    type VirtualPoolState,
} from './types'
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js'
import { VirtualCurve } from '.'
import {
    deriveDammMigrationMetadataAddress,
    deriveEventAuthority,
    deriveLockEscrowAddress,
    deriveLpMintAddress,
    deriveMetadata,
    derivePartnerMetadata,
    derivePool,
    derivePoolAuthority,
    derivePositionAddress,
    derivePositionNftAccount,
    deriveProtocolFeeAddress,
    deriveTokenVaultAddress,
    deriveVaultLPAddress,
} from './derive'
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddressSync,
    NATIVE_MINT,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
    DAMM_V1_PROGRAM_ID,
    DAMM_V2_PROGRAM_ID,
    METADATA_PROGRAM_ID,
    VAULT_PROGRAM_ID,
} from './constants'
import {
    createProgram,
    findAssociatedTokenAddress,
    unwrapSOLInstruction,
    wrapSOLInstruction,
} from './utils'
import type { Program } from '@coral-xyz/anchor'
import type { VirtualCurve as VirtualCurveIDL } from './idl/virtual-curve/idl'
import BN from 'bn.js'
import { swapQuote } from './math/swapQuote'
import { createLockEscrowIx, createVaultIfNotExists } from './common'

export class VirtualCurveClient
    extends VirtualCurve
    implements VirtualCurveClientInterface
{
    public pool: PublicKey
    public virtualPoolState: VirtualPoolState
    public poolConfigState: PoolConfigState

    constructor(
        program: Program<VirtualCurveIDL>,
        pool: PublicKey,
        virtualPoolState: VirtualPoolState,
        poolConfigState: PoolConfigState
    ) {
        super(program)

        this.pool = pool
        this.virtualPoolState = virtualPoolState
        this.poolConfigState = poolConfigState
    }

    /**
     * Create a new VirtualCurveClient instance
     * @param connection - The connection to the Solana network
     * @param pool - The public key of the pool
     * @returns A new VirtualCurveClient instance
     */
    static async create(
        connection: Connection,
        pool: PublicKey
    ): Promise<VirtualCurveClient> {
        const { program } = createProgram(connection)
        const virtualPoolState = await program.account.virtualPool.fetch(pool)
        const poolConfigState = await program.account.poolConfig.fetch(
            virtualPoolState.config
        )
        return new VirtualCurveClient(
            program,
            pool,
            virtualPoolState,
            poolConfigState
        )
    }

    ////////////////////
    // MAIN FUNCTIONS //
    ////////////////////

    /**
     * Create a new pool
     * @param connection - The connection to the Solana network
     * @param createPoolParam - The parameters for the pool
     * @returns A new pool
     */
    static async createPool(
        connection: Connection,
        createPoolParam: CreatePoolParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const {
            quoteMint,
            baseMint,
            config,
            baseTokenType,
            quoteTokenType,
            name,
            symbol,
            uri,
            creator,
        } = createPoolParam

        const eventAuthority = deriveEventAuthority(program.programId)
        const poolAuthority = derivePoolAuthority(program.programId)
        const pool = derivePool(quoteMint, baseMint, config, program.programId)
        const baseVault = deriveTokenVaultAddress(
            pool,
            baseMint,
            program.programId
        )
        const quoteVault = deriveTokenVaultAddress(
            pool,
            quoteMint,
            program.programId
        )
        const baseMetadata = deriveMetadata(baseMint)

        if (baseTokenType === TokenType.SPL) {
            const accounts: InitializeVirtualPoolWithSplTokenAccounts = {
                pool,
                config,
                creator,
                mintMetadata: baseMetadata,
                program: program.programId,
                tokenQuoteProgram:
                    quoteTokenType === TokenType.SPL
                        ? TOKEN_PROGRAM_ID
                        : TOKEN_2022_PROGRAM_ID,
                baseMint,
                payer: creator,
                poolAuthority,
                baseVault,
                quoteVault,
                quoteMint,
                eventAuthority,
                metadataProgram: METADATA_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            }
            return program.methods
                .initializeVirtualPoolWithSplToken({
                    name,
                    symbol,
                    uri,
                })
                .accounts(accounts)
                .transaction()
        }

        if (baseTokenType === TokenType.Token2022) {
            const accounts: InitializeVirtualPoolWithToken2022Accounts = {
                pool,
                config,
                creator,
                program: program.programId,
                tokenQuoteProgram:
                    quoteTokenType === TokenType.SPL
                        ? TOKEN_PROGRAM_ID
                        : TOKEN_2022_PROGRAM_ID,
                baseMint,
                payer: creator,
                poolAuthority,
                baseVault,
                quoteVault,
                quoteMint,
                eventAuthority,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            }
            return program.methods
                .initializeVirtualPoolWithToken2022({
                    name,
                    symbol,
                    uri,
                })
                .accounts(accounts)
                .transaction()
        }

        throw new Error('Invalid base token type')
    }

    /**
     * Swap between base and quote
     * @param swapParam - The parameters for the swap
     * @returns A swap transaction
     */
    async swap(swapParam: SwapParam): Promise<Transaction> {
        const { amountIn, minimumAmountOut, swapBaseForQuote, owner } =
            swapParam

        const { inputMint, outputMint, inputTokenProgram, outputTokenProgram } =
            (() => {
                if (swapBaseForQuote) {
                    return {
                        inputMint: new PublicKey(
                            this.virtualPoolState.baseMint
                        ),
                        outputMint: new PublicKey(
                            this.poolConfigState.quoteMint
                        ),
                        inputTokenProgram:
                            this.virtualPoolState.poolType === TokenType.SPL
                                ? TOKEN_PROGRAM_ID
                                : TOKEN_2022_PROGRAM_ID,
                        outputTokenProgram:
                            this.poolConfigState.quoteTokenFlag ===
                            TokenType.SPL
                                ? TOKEN_PROGRAM_ID
                                : TOKEN_2022_PROGRAM_ID,
                    }
                } else {
                    return {
                        inputMint: new PublicKey(
                            this.poolConfigState.quoteMint
                        ),
                        outputMint: new PublicKey(
                            this.virtualPoolState.baseMint
                        ),
                        inputTokenProgram:
                            this.poolConfigState.quoteTokenFlag ===
                            TokenType.SPL
                                ? TOKEN_PROGRAM_ID
                                : TOKEN_2022_PROGRAM_ID,
                        outputTokenProgram:
                            this.virtualPoolState.poolType === TokenType.SPL
                                ? TOKEN_PROGRAM_ID
                                : TOKEN_2022_PROGRAM_ID,
                    }
                }
            })()

        const eventAuthority = deriveEventAuthority(this.program.programId)
        const poolAuthority = derivePoolAuthority(this.program.programId)

        const inputTokenAccount = findAssociatedTokenAddress(
            owner,
            inputMint,
            inputTokenProgram
        )

        const outputTokenAccount = findAssociatedTokenAddress(
            owner,
            outputMint,
            outputTokenProgram
        )

        const isSOLInput = inputMint.toString() === NATIVE_MINT.toString()
        const isSOLOutput = outputMint.toString() === NATIVE_MINT.toString()

        const ixs = []
        const cleanupIxs = []
        if (isSOLInput) {
            ixs.push(
                createAssociatedTokenAccountIdempotentInstruction(
                    owner,
                    inputTokenAccount,
                    owner,
                    inputMint
                )
            )
            ixs.push(
                ...wrapSOLInstruction(
                    owner,
                    inputTokenAccount,
                    BigInt(amountIn.toString())
                )
            )
            cleanupIxs.push(unwrapSOLInstruction(owner))
        }

        ixs.push(
            createAssociatedTokenAccountIdempotentInstruction(
                owner,
                outputTokenAccount,
                owner,
                outputMint
            )
        )

        if (isSOLOutput) {
            cleanupIxs.push(unwrapSOLInstruction(owner))
        }

        const accounts: SwapAccounts = {
            baseMint: this.virtualPoolState.baseMint,
            quoteMint: this.poolConfigState.quoteMint,
            pool: this.pool,
            baseVault: this.virtualPoolState.baseVault,
            quoteVault: this.virtualPoolState.quoteVault,
            config: this.virtualPoolState.config,
            eventAuthority,
            poolAuthority,
            referralTokenAccount: null,
            inputTokenAccount,
            outputTokenAccount,
            payer: owner,
            tokenBaseProgram: swapBaseForQuote
                ? inputTokenProgram
                : outputTokenProgram,
            tokenQuoteProgram: swapBaseForQuote
                ? outputTokenProgram
                : inputTokenProgram,
            program: this.program.programId,
        }

        const transaction = await this.program.methods
            .swap({
                amountIn,
                minimumAmountOut,
            })
            .accounts(accounts)
            .transaction()
        return transaction
    }

    /**
     * Calculate the amount out for a swap (quote)
     * @param virtualPool - The virtual pool
     * @param config - The config
     * @param swapBaseForQuote - Whether to swap base for quote
     * @param amountIn - The amount in
     * @param hasReferral - Whether the referral is enabled
     * @param currentPoint - The current point
     * @returns
     */
    swapQuote(
        virtualPool: VirtualPool,
        config: PoolConfig,
        swapBaseForQuote: boolean,
        amountIn: BN,
        hasReferral: boolean,
        currentPoint: BN
    ) {
        return swapQuote(
            virtualPool,
            config,
            swapBaseForQuote,
            amountIn,
            hasReferral,
            currentPoint
        )
    }

    ///////////////////////
    // PARTNER FUNCTIONS //
    ///////////////////////

    /**
     * Create a new config
     * @param connection - The connection to the Solana network
     * @param createConfigParam - The parameters for the config
     * @returns A new config
     */
    static async createConfig(
        connection: Connection,
        createConfigParam: CreateConfigParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const { config, feeClaimer, owner, quoteMint, payer, ...configParam } =
            createConfigParam
        const eventAuthority = deriveEventAuthority(program.programId)
        const accounts = {
            config,
            feeClaimer,
            owner,
            quoteMint,
            payer,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .createConfig(configParam)
            .accounts(accounts)
            .transaction()
    }

    /**
     * Claim trading fee
     * @param connection - The connection to the Solana network
     * @param claimTradingFeeParam - The parameters for the claim trading fee
     * @returns A claim trading fee transaction
     */
    async claimTradingFee(
        claimTradingFeeParam: ClaimTradingFeeParam
    ): Promise<Transaction> {
        const poolAuthority = derivePoolAuthority(this.program.programId)
        const eventAuthority = deriveEventAuthority(this.program.programId)

        const tokenBaseAccount = findAssociatedTokenAddress(
            claimTradingFeeParam.feeClaimer,
            this.virtualPoolState.baseMint,
            this.virtualPoolState.poolType === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID
        )

        const tokenQuoteAccount = findAssociatedTokenAddress(
            claimTradingFeeParam.feeClaimer,
            this.poolConfigState.quoteMint,
            this.poolConfigState.quoteTokenFlag === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID
        )

        const accounts = {
            poolAuthority,
            config: this.virtualPoolState.config,
            pool: claimTradingFeeParam.pool,
            tokenAAccount: tokenBaseAccount,
            tokenBAccount: tokenQuoteAccount,
            baseVault: this.virtualPoolState.baseVault,
            quoteVault: this.virtualPoolState.quoteVault,
            baseMint: this.virtualPoolState.baseMint,
            quoteMint: this.poolConfigState.quoteMint,
            feeClaimer: claimTradingFeeParam.feeClaimer,
            tokenBaseProgram:
                this.virtualPoolState.poolType === TokenType.SPL
                    ? TOKEN_PROGRAM_ID
                    : TOKEN_2022_PROGRAM_ID,
            tokenQuoteProgram:
                this.poolConfigState.quoteTokenFlag === TokenType.SPL
                    ? TOKEN_PROGRAM_ID
                    : TOKEN_2022_PROGRAM_ID,
            eventAuthority,
            program: this.program.programId,
        }

        return this.program.methods
            .claimTradingFee(
                claimTradingFeeParam.maxBaseAmount,
                claimTradingFeeParam.maxQuoteAmount
            )
            .accounts(accounts)
            .transaction()
    }

    /**
     * Create partner metadata
     * @param connection - The connection to the Solana network
     * @param feeClaimer - The partner's fee claimer account (must be a signer)
     * @param payer - The account paying for the metadata creation (must be a signer)
     * @param name - Partner's name
     * @param website - Partner's website
     * @param logo - Partner's logo URL
     * @returns A create partner metadata transaction
     */
    static async createPartnerMetadata(
        connection: Connection,
        createPartnerMetadataParam: CreatePartnerMetadataParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const eventAuthority = deriveEventAuthority(program.programId)
        const partnerMetadata = derivePartnerMetadata(
            createPartnerMetadataParam.feeClaimer,
            program.programId
        )

        const partnerMetadataParam: CreatePartnerMetadataParameters = {
            padding: new Array(96).fill(0),
            name: createPartnerMetadataParam.name,
            website: createPartnerMetadataParam.website,
            logo: createPartnerMetadataParam.logo,
        }

        const accounts = {
            partnerMetadata,
            payer: createPartnerMetadataParam.payer,
            feeClaimer: createPartnerMetadataParam.feeClaimer,
            systemProgram: SystemProgram.programId,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .createPartnerMetadata(partnerMetadataParam)
            .accounts(accounts)
            .transaction()
    }

    /**
     * Partner withdraw surplus
     * @param connection - The connection to the Solana network
     * @param params - The parameters for the partner withdraw surplus
     * @returns A partner withdraw surplus transaction
     */
    async partnerWithdrawSurplus(
        partnerWithdrawSurplusParam: PartnerWithdrawSurplusParam
    ): Promise<Transaction> {
        const poolAuthority = derivePoolAuthority(this.program.programId)
        const eventAuthority = deriveEventAuthority(this.program.programId)

        const tokenQuoteAccount = findAssociatedTokenAddress(
            partnerWithdrawSurplusParam.feeClaimer,
            this.poolConfigState.quoteMint,
            this.poolConfigState.quoteTokenFlag === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID
        )

        const accounts = {
            poolAuthority,
            config: this.virtualPoolState.config,
            virtualPool: partnerWithdrawSurplusParam.virtualPool,
            tokenQuoteAccount,
            quoteVault: this.virtualPoolState.quoteVault,
            quoteMint: this.poolConfigState.quoteMint,
            feeClaimer: partnerWithdrawSurplusParam.feeClaimer,
            tokenQuoteProgram:
                this.poolConfigState.quoteTokenFlag === TokenType.SPL
                    ? TOKEN_PROGRAM_ID
                    : TOKEN_2022_PROGRAM_ID,
            eventAuthority,
            program: this.program.programId,
        }

        return this.program.methods
            .partnerWithdrawSurplus()
            .accounts(accounts)
            .transaction()
    }

    /////////////////////////
    // MIGRATION FUNCTIONS //
    /////////////////////////

    /**
     * Create metadata for the migration of Meteora DAMM V1 or DAMM V2
     * @param connection - The connection to the Solana network
     * @param createDammMigrationMetadataParam - The parameters for the migration
     * @returns A migration transaction
     */
    static async createDammMigrationMetadata(
        connection: Connection,
        createDammMigrationMetadataParam: CreateDammMigrationMetadataParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            createDammMigrationMetadataParam.virtualPool,
            program.programId,
            createDammMigrationMetadataParam.migrateToDammV2
        )

        const accounts = {
            virtualPool: createDammMigrationMetadataParam.virtualPool,
            config: createDammMigrationMetadataParam.config,
            migrationMetadata: migrationMetadata,
            payer: createDammMigrationMetadataParam.payer,
            systemProgram: SystemProgram.programId,
        }

        if (createDammMigrationMetadataParam.migrateToDammV2) {
            return program.methods
                .migrationDammV2CreateMetadata()
                .accountsPartial(accounts)
                .transaction()
        } else {
            return program.methods
                .migrationMeteoraDammCreateMetadata()
                .accountsPartial(accounts)
                .transaction()
        }
    }

    /**
     * Migrate pool to DAMM V1 or DAMM V2
     * @param connection - The connection to the Solana network
     * @param migrateToDammParam - The parameters for the migration
     * @returns A migration transaction
     */
    async migrateToDamm(
        connection: Connection,
        migrateToDammParam: MigrateToDammParam
    ): Promise<Transaction> {
        const virtualPoolState = this.virtualPoolState
        const poolConfigState = this.poolConfigState

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            migrateToDammParam.virtualPool,
            this.program.programId,
            migrateToDammParam.migrateToDammV2
        )

        if (migrateToDammParam.migrateToDammV2) {
            const poolAuthority = derivePoolAuthority(DAMM_V2_PROGRAM_ID)
            const dammPoolAuthority = derivePoolAuthority(DAMM_V2_PROGRAM_ID)
            const dammEventAuthority = deriveEventAuthority(DAMM_V2_PROGRAM_ID)

            const dammPool = derivePool(
                virtualPoolState.baseMint,
                poolConfigState.quoteMint,
                migrateToDammParam.dammConfig,
                DAMM_V2_PROGRAM_ID
            )

            const firstPositionNftKP = Keypair.generate()
            const firstPosition = derivePositionAddress(
                firstPositionNftKP.publicKey,
                DAMM_V2_PROGRAM_ID
            )
            const firstPositionNftAccount = derivePositionNftAccount(
                firstPositionNftKP.publicKey,
                DAMM_V2_PROGRAM_ID
            )

            const secondPositionNftKP = Keypair.generate()
            const secondPosition = derivePositionAddress(
                secondPositionNftKP.publicKey,
                DAMM_V2_PROGRAM_ID
            )
            const secondPositionNftAccount = derivePositionNftAccount(
                secondPositionNftKP.publicKey,
                DAMM_V2_PROGRAM_ID
            )

            const tokenAVault = deriveTokenVaultAddress(
                virtualPoolState.baseMint,
                dammPool,
                DAMM_V2_PROGRAM_ID
            )
            const tokenBVault = deriveTokenVaultAddress(
                poolConfigState.quoteMint,
                dammPool,
                DAMM_V2_PROGRAM_ID
            )

            const tokenBaseProgram =
                poolConfigState.tokenType == 0
                    ? TOKEN_PROGRAM_ID
                    : TOKEN_2022_PROGRAM_ID

            const tokenQuoteProgram =
                poolConfigState.tokenType == 0
                    ? TOKEN_PROGRAM_ID
                    : TOKEN_2022_PROGRAM_ID

            return this.program.methods
                .migrationDammV2()
                .accountsStrict({
                    virtualPool: migrateToDammParam.virtualPool,
                    migrationMetadata,
                    config: virtualPoolState.config,
                    poolAuthority,
                    pool: dammPool,
                    firstPositionNftMint: firstPositionNftKP.publicKey,
                    firstPosition,
                    firstPositionNftAccount,
                    secondPositionNftMint: secondPositionNftKP.publicKey,
                    secondPosition,
                    secondPositionNftAccount,
                    dammPoolAuthority,
                    ammProgram: DAMM_V2_PROGRAM_ID,
                    baseMint: virtualPoolState.baseMint,
                    quoteMint: poolConfigState.quoteMint,
                    tokenAVault,
                    tokenBVault,
                    baseVault: virtualPoolState.baseVault,
                    quoteVault: virtualPoolState.quoteVault,
                    payer: migrateToDammParam.payer,
                    tokenBaseProgram,
                    tokenQuoteProgram,
                    token2022Program: TOKEN_2022_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    dammEventAuthority,
                })
                .remainingAccounts([
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: migrateToDammParam.dammConfig,
                    },
                ])
                .transaction()
        } else {
            const poolAuthority = derivePoolAuthority(this.program.programId)

            const dammPool = derivePool(
                virtualPoolState.baseMint,
                poolConfigState.quoteMint,
                migrateToDammParam.dammConfig,
                DAMM_V1_PROGRAM_ID
            )

            const lpMint = deriveLpMintAddress(dammPool, DAMM_V1_PROGRAM_ID)

            const mintMetadata = deriveMetadata(lpMint)

            const [protocolTokenAFee, protocolTokenBFee] = [
                deriveProtocolFeeAddress(
                    virtualPoolState.baseMint,
                    dammPool,
                    DAMM_V1_PROGRAM_ID
                ),
                deriveProtocolFeeAddress(
                    poolConfigState.quoteMint,
                    dammPool,
                    DAMM_V1_PROGRAM_ID
                ),
            ]

            const preInstructions: TransactionInstruction[] = []

            const {
                vaultPda: aVault,
                tokenVaultPda: aTokenVault,
                lpMintPda: aVaultLpMint,
                ix: createAVaultIx,
            } = await createVaultIfNotExists(
                virtualPoolState.baseMint,
                connection,
                migrateToDammParam.payer
            )

            if (createAVaultIx) {
                preInstructions.push(createAVaultIx)
            }

            const {
                vaultPda: bVault,
                tokenVaultPda: bTokenVault,
                lpMintPda: bVaultLpMint,
                ix: createBVaultIx,
            } = await createVaultIfNotExists(
                poolConfigState.quoteMint,
                connection,
                migrateToDammParam.payer
            )

            if (createBVaultIx) {
                preInstructions.push(createBVaultIx)
            }

            const [aVaultLp, bVaultLp] = [
                deriveVaultLPAddress(aVault, dammPool, DAMM_V1_PROGRAM_ID),
                deriveVaultLPAddress(bVault, dammPool, DAMM_V1_PROGRAM_ID),
            ]

            const virtualPoolLp = getAssociatedTokenAddressSync(
                lpMint,
                poolAuthority,
                true,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )

            return this.program.methods
                .migrateMeteoraDamm()
                .accountsStrict({
                    virtualPool: migrateToDammParam.virtualPool,
                    migrationMetadata,
                    config: virtualPoolState.config,
                    poolAuthority,
                    pool: dammPool,
                    dammConfig: migrateToDammParam.dammConfig,
                    lpMint,
                    tokenAMint: virtualPoolState.baseMint,
                    tokenBMint: poolConfigState.quoteMint,
                    aVault,
                    bVault,
                    aTokenVault,
                    bTokenVault,
                    aVaultLpMint,
                    bVaultLpMint,
                    aVaultLp,
                    bVaultLp,
                    baseVault: virtualPoolState.baseVault,
                    quoteVault: virtualPoolState.quoteVault,
                    virtualPoolLp,
                    protocolTokenAFee,
                    protocolTokenBFee,
                    payer: migrateToDammParam.payer,
                    rent: SYSVAR_RENT_PUBKEY,
                    mintMetadata,
                    metadataProgram: METADATA_PROGRAM_ID,
                    ammProgram: DAMM_V1_PROGRAM_ID,
                    vaultProgram: VAULT_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .preInstructions(preInstructions)
                .transaction()
        }
    }

    /////////////
    // DAMM V1 //
    /////////////

    /**
     * Lock DAMM LP token for creator or partner
     * @param connection - The connection to the Solana network
     * @param lockDammLpTokenParam - The parameters for the lock
     * @returns A lock transaction
     */
    async lockDammLpToken(
        connection: Connection,
        lockDammLpTokenParam: DammLpTokenParam
    ): Promise<Transaction> {
        const virtualPoolState = this.virtualPoolState
        const poolConfigState = this.poolConfigState

        const poolAuthority = derivePoolAuthority(this.program.programId)

        const dammPool = derivePool(
            lockDammLpTokenParam.dammConfig,
            virtualPoolState.baseMint,
            poolConfigState.quoteMint,
            DAMM_V1_PROGRAM_ID
        )

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            lockDammLpTokenParam.virtualPool,
            DAMM_V1_PROGRAM_ID,
            false
        )

        const [
            { vaultPda: aVault, lpMintPda: aVaultLpMint },
            { vaultPda: bVault, lpMintPda: bVaultLpMint },
        ] = await Promise.all([
            createVaultIfNotExists(
                virtualPoolState.baseMint,
                connection,
                lockDammLpTokenParam.payer
            ),
            createVaultIfNotExists(
                poolConfigState.quoteMint,
                connection,
                lockDammLpTokenParam.payer
            ),
        ])

        const [aVaultLp, bVaultLp] = [
            deriveVaultLPAddress(aVault, dammPool, DAMM_V1_PROGRAM_ID),
            deriveVaultLPAddress(bVault, dammPool, DAMM_V1_PROGRAM_ID),
        ]

        const lpMint = deriveLpMintAddress(dammPool, DAMM_V1_PROGRAM_ID)

        const lockEscrowKey = deriveLockEscrowAddress(
            dammPool,
            virtualPoolState.creator,
            DAMM_V1_PROGRAM_ID
        )

        const lockEscrowData = await connection.getAccountInfo(lockEscrowKey)

        const preInstructions: TransactionInstruction[] = []

        if (!lockEscrowData) {
            const ix = await createLockEscrowIx(
                connection,
                lockDammLpTokenParam.payer,
                dammPool,
                lpMint,
                virtualPoolState.creator,
                lockEscrowKey
            )

            preInstructions.push(ix)
        }

        const escrowVault = getAssociatedTokenAddressSync(
            lpMint,
            lockEscrowKey,
            true,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )

        const createEscrowVaultIx =
            createAssociatedTokenAccountIdempotentInstruction(
                lockDammLpTokenParam.payer,
                escrowVault,
                lockEscrowKey,
                lpMint,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        preInstructions.push(createEscrowVaultIx)

        const sourceTokens = getAssociatedTokenAddressSync(
            lpMint,
            poolAuthority,
            true
        )

        const accounts = {
            migrationMetadata,
            poolAuthority,
            pool: dammPool,
            lpMint,
            lockEscrow: lockEscrowKey,
            owner: virtualPoolState.creator,
            sourceTokens,
            escrowVault,
            ammProgram: DAMM_V1_PROGRAM_ID,
            aVault,
            bVault,
            aVaultLp,
            bVaultLp,
            aVaultLpMint,
            bVaultLpMint,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        if (lockDammLpTokenParam.isPartner) {
            return this.program.methods
                .migrateMeteoraDammLockLpTokenForPartner()
                .accountsStrict(accounts)
                .preInstructions(preInstructions)
                .transaction()
        } else {
            return this.program.methods
                .migrateMeteoraDammLockLpTokenForCreator()
                .accountsStrict(accounts)
                .preInstructions(preInstructions)
                .transaction()
        }
    }

    /**
     * Claim DAMM LP token for creator or partner
     * @param connection - The connection to the Solana network
     * @param claimDammLpTokenParam - The parameters for the claim
     * @returns A claim transaction
     */
    async claimDammLpToken(
        connection: Connection,
        claimDammLpTokenParam: DammLpTokenParam
    ): Promise<Transaction> {
        const virtualPoolState = this.virtualPoolState
        const poolConfigState = this.poolConfigState

        const poolAuthority = derivePoolAuthority(this.program.programId)

        const dammPool = derivePool(
            claimDammLpTokenParam.dammConfig,
            virtualPoolState.baseMint,
            poolConfigState.quoteMint,
            DAMM_V1_PROGRAM_ID
        )

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            claimDammLpTokenParam.virtualPool,
            DAMM_V1_PROGRAM_ID,
            false
        )

        const lpMint = deriveLpMintAddress(dammPool, DAMM_V1_PROGRAM_ID)

        const preInstructions: TransactionInstruction[] = []
        const destinationToken = getAssociatedTokenAddressSync(
            lpMint,
            claimDammLpTokenParam.payer,
            true,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )

        const createDestinationTokenIx =
            createAssociatedTokenAccountIdempotentInstruction(
                claimDammLpTokenParam.payer,
                destinationToken,
                claimDammLpTokenParam.payer,
                lpMint,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        preInstructions.push(createDestinationTokenIx)

        const sourceToken = getAssociatedTokenAddressSync(
            lpMint,
            poolAuthority,
            true
        )

        const accounts = {
            migrationMetadata,
            poolAuthority,
            pool: dammPool,
            lpMint,
            sourceToken,
            destinationToken,
            sender: claimDammLpTokenParam.payer,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        if (claimDammLpTokenParam.isPartner) {
            return this.program.methods
                .migrateMeteoraDammPartnerClaimLpToken()
                .accounts(accounts)
                .preInstructions(preInstructions)
                .transaction()
        } else {
            return this.program.methods
                .migrateMeteoraDammCreatorClaimLpToken()
                .accounts(accounts)
                .preInstructions(preInstructions)
                .transaction()
        }
    }
    /**
     * Get meteora DAMM migration metadata
     * @param connection - The connection to the Solana network
     * @param metadataAddress - The address of the meteora DAMM migration metadata
     * @returns A meteora DAMM migration metadata
     */
    static async getMeteoraDammMigrationMetadata(
        connection: Connection,
        metadataAddress: PublicKey | string
    ): Promise<MeteoraDammMigrationMetadata> {
        const { program } = createProgram(connection)
        const metadata =
            await program.account.meteoraDammMigrationMetadata.fetch(
                metadataAddress instanceof PublicKey
                    ? metadataAddress
                    : new PublicKey(metadataAddress)
            )

        return metadata
    }
}
