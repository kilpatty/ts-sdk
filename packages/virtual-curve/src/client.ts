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
    type PartnerWithdrawSurplusParam,
    type SwapAccounts,
    type SwapParam,
    type MigrateToDammV1Param,
    type MigrateToDammV2Param,
    type PoolConfig,
    type VirtualPool,
    type Config,
    type ClaimFeeOperator,
    type PartnerMetadata,
    type CreateVirtualPoolMetadataParam,
    type CreateVirtualPoolMetadataParameters,
    type VirtualPoolMetadata,
    type CreateLockerParam,
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
import {
    deriveBaseKeyForLocker,
    deriveDammMigrationMetadataAddress,
    deriveDammV2EventAuthority,
    deriveEscrow,
    deriveEventAuthority,
    deriveLockerEventAuthority,
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
    deriveVirtualPoolMetadata,
} from './derive'
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
    DAMM_V1_PROGRAM_ID,
    DAMM_V2_PROGRAM_ID,
    LOCKER_PROGRAM_ID,
    METAPLEX_PROGRAM_ID,
    VAULT_PROGRAM_ID,
} from './constants'
import {
    createDammV1Program,
    createProgram,
    createVaultProgram,
    findAssociatedTokenAddress,
    getAccountData,
    isNativeSol,
    unwrapSOLInstruction,
    wrapSOLInstruction,
    createProgramAccountFilter,
} from './utils'
import type { Program, ProgramAccount } from '@coral-xyz/anchor'
import type { VirtualCurve as VirtualCurveIDL } from './idl/virtual-curve/idl'
import BN from 'bn.js'
import { swapQuote } from './math/swapQuote'
import {
    createLockEscrowIx,
    createVaultIfNotExists,
    prepareSwapParams,
} from './common'

export class VirtualCurveProgramClient {
    private program: Program<VirtualCurveIDL>

    constructor(connection: Connection) {
        const { program } = createProgram(connection)
        this.program = program
    }

    /**
     * Get the underlying program instance
     * @returns The program instance
     */
    getProgram(): Program<VirtualCurveIDL> {
        return this.program
    }

    /**
     * Get virtual pool
     * @param connection - The connection to the Solana network
     * @param poolAddress - The address of the pool
     * @returns A virtual pool or null if not found
     */
    async getPool(
        connection: Connection,
        poolAddress: PublicKey | string
    ): Promise<VirtualPool | null> {
        return getAccountData<VirtualPool>(
            connection,
            poolAddress,
            'virtualPool',
            this.program
        )
    }

    /**
     * Retrieves all virtual pools
     * @param connection - The connection to the Solana network
     * @returns Array of pool accounts with their addresses
     */
    async getPools(): Promise<ProgramAccount<VirtualPool>[]> {
        return await this.program.account.virtualPool.all()
    }

    /**
     * Get config
     * @param connection - The connection to the Solana network
     * @param configAddress - The address of the config
     * @returns A config
     */
    async getConfig(
        connection: Connection,
        configAddress: PublicKey | string
    ): Promise<Config> {
        return getAccountData<Config>(
            connection,
            configAddress,
            'config',
            this.program
        )
    }

    /**
     * Get pool config (partner config)
     * @param connection - The connection to the Solana network
     * @param poolConfigAddress - The address of the pool config
     * @returns A pool config
     */
    async getPoolConfig(
        connection: Connection,
        poolConfigAddress: PublicKey | string
    ): Promise<PoolConfig> {
        return getAccountData<PoolConfig>(
            connection,
            poolConfigAddress,
            'poolConfig',
            this.program
        )
    }

    /**
     * Retrieve all pool configs (list of all configs launched by partner)
     * @param connection - The connection to the Solana network
     * @param owner - The owner of the pool configs
     * @returns An array of pool configs
     */
    async getPoolConfigs(
        owner?: PublicKey | string
    ): Promise<(ProgramAccount<PoolConfig> & { createdAt?: Date })[]> {
        const filters = owner ? createProgramAccountFilter(owner, 72) : []
        const poolConfigs = await this.program.account.poolConfig.all(filters)

        // Get signatures for all pool configs in parallel
        const signaturePromises = poolConfigs.map(async (config) => {
            const signatures =
                await this.program.provider.connection.getSignaturesForAddress(
                    config.publicKey,
                    { limit: 1 },
                    'confirmed'
                )
            return signatures[0]?.blockTime
                ? new Date(signatures[0].blockTime * 1000)
                : undefined
        })

        const timestamps = await Promise.all(signaturePromises)

        // Combine the pool configs with their creation timestamps
        return poolConfigs.map((config, index) => ({
            ...config,
            createdAt: timestamps[index],
        }))
    }

    /**
     * Get virtual pool metadata
     * @param connection - The connection to the Solana network
     * @param virtualPoolAddress - The address of the virtual pool
     * @returns A virtual pool metadata
     */
    async getPoolMetadata(
        virtualPoolAddress: PublicKey | string
    ): Promise<VirtualPoolMetadata[]> {
        const filters = createProgramAccountFilter(virtualPoolAddress, 8)
        const accounts =
            await this.program.account.virtualPoolMetadata.all(filters)
        return accounts.map((account) => account.account)
    }

    /**
     * Get claim fee operator
     * @param connection - The connection to the Solana network
     * @param operatorAddress - The address of the claim fee operator
     * @returns A claim fee operator
     */
    async getClaimFeeOperator(
        connection: Connection,
        operatorAddress: PublicKey | string
    ): Promise<ClaimFeeOperator> {
        return getAccountData<ClaimFeeOperator>(
            connection,
            operatorAddress,
            'claimFeeOperator',
            this.program
        )
    }

    /**
     * Get partner metadata
     * @param connection - The connection to the Solana network
     * @param partnerAddress - The address of the partner
     * @returns A partner metadata
     */
    async getPartnerMetadata(
        partnerAccountAddress: PublicKey | string
    ): Promise<PartnerMetadata[]> {
        const filters = createProgramAccountFilter(partnerAccountAddress, 8)
        const accounts = await this.program.account.partnerMetadata.all(filters)
        return accounts.map((account) => account.account)
    }

    /**
     * Calculate the amount out for a swap (quote)
     * @param virtualPool - The virtual pool
     * @param config - The config
     * @param swapBaseForQuote - Whether to swap base for quote
     * @param amountIn - The amount in
     * @param hasReferral - Whether the referral is enabled
     * @param currentPoint - The current point
     * @returns The swap quote result
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
}

/**
 * Pool-related operations
 */
export class PoolService {
    constructor(private programClient: VirtualCurveProgramClient) {}

    /**
     * Create a new pool
     * @param connection - The connection to the Solana network
     * @param createPoolParam - The parameters for the pool
     * @returns A new pool
     */
    async createPool(createPoolParam: CreatePoolParam): Promise<Transaction> {
        const program = this.programClient.getProgram()
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

        const eventAuthority = deriveEventAuthority()
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
                metadataProgram: METAPLEX_PROGRAM_ID,
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
                baseMint,
                payer: creator,
                poolAuthority,
                baseVault,
                quoteVault,
                quoteMint,
                eventAuthority,
                tokenQuoteProgram: TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
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
     * Create virtual pool metadata
     * @param connection - The connection to the Solana network
     * @param createVirtualPoolMetadataParam - The parameters for the virtual pool metadata
     * @returns A create virtual pool metadata transaction
     */
    async createPoolMetadata(
        createVirtualPoolMetadataParam: CreateVirtualPoolMetadataParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const eventAuthority = deriveEventAuthority()
        const virtualPoolMetadata = deriveVirtualPoolMetadata(
            createVirtualPoolMetadataParam.virtualPool
        )
        const virtualPoolMetadataParam: CreateVirtualPoolMetadataParameters = {
            padding: new Array(96).fill(0),
            name: createVirtualPoolMetadataParam.name,
            website: createVirtualPoolMetadataParam.website,
            logo: createVirtualPoolMetadataParam.logo,
        }

        const accounts = {
            virtualPool: createVirtualPoolMetadataParam.virtualPool,
            virtualPoolMetadata,
            creator: createVirtualPoolMetadataParam.creator,
            payer: createVirtualPoolMetadataParam.payer,
            systemProgram: SystemProgram.programId,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .createVirtualPoolMetadata(virtualPoolMetadataParam)
            .accounts(accounts)
            .transaction()
    }

    /**
     * Swap between base and quote
     * @param pool - The pool address
     * @param swapParam - The parameters for the swap
     * @returns A swap transaction
     */
    async swap(
        pool: PublicKey,
        swapParam: SwapParam,
        connection: Connection
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const virtualPoolState = await this.programClient.getPool(
            connection,
            pool
        )
        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${pool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            connection,
            virtualPoolState.config
        )

        const { amountIn, minimumAmountOut, swapBaseForQuote, owner } =
            swapParam

        const { inputMint, outputMint, inputTokenProgram, outputTokenProgram } =
            prepareSwapParams(
                swapBaseForQuote,
                virtualPoolState,
                poolConfigState
            )

        const eventAuthority = deriveEventAuthority()
        const poolAuthority = derivePoolAuthority(program.programId)

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

        const isSOLInput = isNativeSol(inputMint)
        const isSOLOutput = isNativeSol(outputMint)

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
            const unwrapIx = unwrapSOLInstruction(owner)
            if (unwrapIx) {
                cleanupIxs.push(unwrapIx)
            }
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
            const unwrapIx = unwrapSOLInstruction(owner)
            if (unwrapIx) {
                cleanupIxs.push(unwrapIx)
            }
        }

        const accounts: SwapAccounts = {
            baseMint: virtualPoolState.baseMint,
            quoteMint: poolConfigState.quoteMint,
            pool: pool,
            baseVault: virtualPoolState.baseVault,
            quoteVault: virtualPoolState.quoteVault,
            config: virtualPoolState.config,
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
            program: program.programId,
        }

        const transaction = await program.methods
            .swap({
                amountIn,
                minimumAmountOut,
            })
            .accounts(accounts)
            .transaction()

        if (ixs.length > 0) {
            transaction.add(...ixs)
        }

        if (cleanupIxs.length > 0) {
            transaction.add(...cleanupIxs)
        }

        return transaction
    }
}

/**
 * Partner-related operations
 */
export class PartnerService {
    constructor(private programClient: VirtualCurveProgramClient) {}

    /**
     * Create a new config
     * @param connection - The connection to the Solana network
     * @param createConfigParam - The parameters for the config
     * @returns A new config
     */
    async createConfig(
        createConfigParam: CreateConfigParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const { config, feeClaimer, owner, quoteMint, payer, ...configParam } =
            createConfigParam
        const eventAuthority = deriveEventAuthority()
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
     * Create partner metadata
     * @param connection - The connection to the Solana network
     * @param createPartnerMetadataParam - The parameters for the partner metadata
     * @returns A create partner metadata transaction
     */
    async createPartnerMetadata(
        createPartnerMetadataParam: CreatePartnerMetadataParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const eventAuthority = deriveEventAuthority()
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
     * Claim trading fee
     * @param pool - The pool address
     * @param claimTradingFeeParam - The parameters for the claim trading fee
     * @returns A claim trading fee transaction
     */
    async claimTradingFee(
        pool: PublicKey,
        claimTradingFeeParam: ClaimTradingFeeParam,
        connection: Connection
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const virtualPoolState = await this.programClient.getPool(
            connection,
            pool
        )
        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${pool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            connection,
            virtualPoolState.config
        )

        const poolAuthority = derivePoolAuthority(program.programId)
        const eventAuthority = deriveEventAuthority()

        const tokenBaseAccount = getAssociatedTokenAddressSync(
            virtualPoolState.baseMint,
            claimTradingFeeParam.feeClaimer,
            true,
            virtualPoolState.poolType === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID
        )

        const tokenQuoteAccount = getAssociatedTokenAddressSync(
            poolConfigState.quoteMint,
            claimTradingFeeParam.feeClaimer,
            true,
            poolConfigState.quoteTokenFlag === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID
        )

        const accounts = {
            poolAuthority,
            config: virtualPoolState.config,
            pool: claimTradingFeeParam.pool,
            tokenAAccount: tokenBaseAccount,
            tokenBAccount: tokenQuoteAccount,
            baseVault: virtualPoolState.baseVault,
            quoteVault: virtualPoolState.quoteVault,
            baseMint: virtualPoolState.baseMint,
            quoteMint: poolConfigState.quoteMint,
            feeClaimer: claimTradingFeeParam.feeClaimer,
            tokenBaseProgram:
                virtualPoolState.poolType === TokenType.SPL
                    ? TOKEN_PROGRAM_ID
                    : TOKEN_2022_PROGRAM_ID,
            tokenQuoteProgram:
                poolConfigState.quoteTokenFlag === TokenType.SPL
                    ? TOKEN_PROGRAM_ID
                    : TOKEN_2022_PROGRAM_ID,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .claimTradingFee(
                claimTradingFeeParam.maxBaseAmount,
                claimTradingFeeParam.maxQuoteAmount
            )
            .accounts(accounts)
            .transaction()
    }

    /**
     * Partner withdraw surplus
     * @param virtualPool - The virtual pool address
     * @param partnerWithdrawSurplusParam - The parameters for the partner withdraw surplus
     * @returns A partner withdraw surplus transaction
     */
    async partnerWithdrawSurplus(
        virtualPool: PublicKey,
        partnerWithdrawSurplusParam: PartnerWithdrawSurplusParam,
        connection: Connection
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const virtualPoolState = await this.programClient.getPool(
            connection,
            virtualPool
        )
        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${virtualPool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            connection,
            virtualPoolState.config
        )

        const poolAuthority = derivePoolAuthority(program.programId)
        const eventAuthority = deriveEventAuthority()

        const tokenQuoteAccount = findAssociatedTokenAddress(
            partnerWithdrawSurplusParam.feeClaimer,
            poolConfigState.quoteMint,
            poolConfigState.quoteTokenFlag === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID
        )

        const accounts = {
            poolAuthority,
            config: virtualPoolState.config,
            virtualPool: partnerWithdrawSurplusParam.virtualPool,
            tokenQuoteAccount,
            quoteVault: virtualPoolState.quoteVault,
            quoteMint: poolConfigState.quoteMint,
            feeClaimer: partnerWithdrawSurplusParam.feeClaimer,
            tokenQuoteProgram:
                poolConfigState.quoteTokenFlag === TokenType.SPL
                    ? TOKEN_PROGRAM_ID
                    : TOKEN_2022_PROGRAM_ID,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .partnerWithdrawSurplus()
            .accounts(accounts)
            .transaction()
    }
}

/**
 * Migration-related operations
 */
export class MigrationService {
    constructor(private programClient: VirtualCurveProgramClient) {}

    /**
     * Create metadata for the migration of Meteora DAMM V1 or DAMM V2
     * @param connection - The connection to the Solana network
     * @param createDammMigrationMetadataParam - The parameters for the migration
     * @returns A migration transaction
     */
    async createDammMigrationMetadata(
        createDammMigrationMetadataParam: CreateDammMigrationMetadataParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

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
     * Create a locker
     * @param connection - The connection to the Solana network
     * @param createLockerParam - The parameters for the locker
     * @returns A create locker transaction
     */
    async createLocker(
        connection: Connection,
        createLockerParam: CreateLockerParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const poolAuthority = derivePoolAuthority(program.programId)
        const lockerEventAuthority = deriveLockerEventAuthority()

        const virtualPoolState = await this.programClient.getPool(
            connection,
            createLockerParam.virtualPool
        )

        if (!virtualPoolState) {
            throw new Error(
                `Pool not found: ${createLockerParam.virtualPool.toString()}`
            )
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            connection,
            virtualPoolState.config
        )

        const base = deriveBaseKeyForLocker(createLockerParam.virtualPool)

        const escrow = deriveEscrow(base)

        const tokenProgram =
            poolConfigState.tokenType === 0
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const preInstructions: TransactionInstruction[] = []

        const escrowToken = getAssociatedTokenAddressSync(
            virtualPoolState.baseMint,
            escrow,
            true,
            tokenProgram
        )

        const createOwnerEscrowVaultTokenXIx =
            createAssociatedTokenAccountIdempotentInstruction(
                createLockerParam.payer,
                escrowToken,
                escrow,
                virtualPoolState.baseMint,
                tokenProgram
            )

        preInstructions.push(createOwnerEscrowVaultTokenXIx)

        const accounts = {
            virtualPool: createLockerParam.virtualPool,
            config: virtualPoolState.config,
            poolAuthority,
            baseVault: virtualPoolState.baseVault,
            baseMint: virtualPoolState.baseMint,
            base,
            creator: virtualPoolState.creator,
            escrow,
            escrowToken,
            payer: createLockerParam.payer,
            tokenProgram,
            lockerProgram: LOCKER_PROGRAM_ID,
            lockerEventAuthority,
            systemProgram: SystemProgram.programId,
        }

        return program.methods
            .createLocker()
            .accounts(accounts)
            .preInstructions(preInstructions)
            .transaction()
    }

    ///////////////////////
    // DAMM V1 FUNCTIONS //
    ///////////////////////

    /**
     * Get DAMM V1 migration metadata
     * @param connection - The connection to the Solana network
     * @param metadataAddress - The address of the meteora DAMM migration metadata
     * @returns A meteora DAMM migration metadata
     */
    async getDammV1MigrationMetadata(
        metadataAddress: PublicKey | string
    ): Promise<MeteoraDammMigrationMetadata> {
        const program = this.programClient.getProgram()
        const metadata =
            await program.account.meteoraDammMigrationMetadata.fetch(
                metadataAddress instanceof PublicKey
                    ? metadataAddress
                    : new PublicKey(metadataAddress)
            )

        return metadata
    }

    /**
     * Migrate to DAMM V1
     * @param connection - The connection to the Solana network
     * @param virtualPool - The virtual pool address
     * @param migrateToDammV1Param - The parameters for the migration
     * @returns A migrate transaction
     */
    async migrateToDammV1(
        connection: Connection,
        virtualPool: PublicKey,
        migrateToDammV1Param: MigrateToDammV1Param
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const virtualPoolState = await this.programClient.getPool(
            connection,
            virtualPool
        )
        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${virtualPool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            connection,
            virtualPoolState.config
        )

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            migrateToDammV1Param.virtualPool,
            program.programId,
            false
        )

        const poolAuthority = derivePoolAuthority(program.programId)

        const dammPool = derivePool(
            poolConfigState.quoteMint,
            virtualPoolState.baseMint,
            migrateToDammV1Param.dammConfig,
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

        const vaultProgram = createVaultProgram(connection)

        const {
            vaultPda: aVault,
            tokenVaultPda: aTokenVault,
            lpMintPda: aVaultLpMint,
            ix: createAVaultIx,
        } = await createVaultIfNotExists(
            virtualPoolState.baseMint,
            vaultProgram,
            migrateToDammV1Param.payer,
            connection
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
            vaultProgram,
            migrateToDammV1Param.payer,
            connection
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

        return program.methods
            .migrateMeteoraDamm()
            .accountsStrict({
                virtualPool: migrateToDammV1Param.virtualPool,
                migrationMetadata,
                config: virtualPoolState.config,
                poolAuthority,
                pool: dammPool,
                dammConfig: migrateToDammV1Param.dammConfig,
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
                payer: migrateToDammV1Param.payer,
                rent: SYSVAR_RENT_PUBKEY,
                mintMetadata,
                metadataProgram: METAPLEX_PROGRAM_ID,
                ammProgram: DAMM_V1_PROGRAM_ID,
                vaultProgram: VAULT_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .preInstructions(preInstructions)
            .transaction()
    }

    /**
     * Lock DAMM V1 LP token for creator or partner
     * @param connection - The connection to the Solana network
     * @param virtualPool - The virtual pool address
     * @param lockDammLpTokenParam - The parameters for the lock
     * @returns A lock transaction
     */
    async lockDammV1LpToken(
        connection: Connection,
        virtualPool: PublicKey,
        lockDammV1LpTokenParam: DammLpTokenParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const virtualPoolState = await this.programClient.getPool(
            connection,
            virtualPool
        )
        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${virtualPool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            connection,
            virtualPoolState.config
        )

        const poolAuthority = derivePoolAuthority(program.programId)

        const dammPool = derivePool(
            poolConfigState.quoteMint,
            virtualPoolState.baseMint,
            lockDammV1LpTokenParam.dammConfig,
            DAMM_V1_PROGRAM_ID
        )

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            lockDammV1LpTokenParam.virtualPool,
            DAMM_V1_PROGRAM_ID,
            false
        )

        const vaultProgram = createVaultProgram(connection)

        const [
            { vaultPda: aVault, lpMintPda: aVaultLpMint },
            { vaultPda: bVault, lpMintPda: bVaultLpMint },
        ] = await Promise.all([
            createVaultIfNotExists(
                virtualPoolState.baseMint,
                vaultProgram,
                lockDammV1LpTokenParam.payer,
                connection
            ),
            createVaultIfNotExists(
                poolConfigState.quoteMint,
                vaultProgram,
                lockDammV1LpTokenParam.payer,
                connection
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

        const dammV1Program = createDammV1Program(connection)

        if (!lockEscrowData) {
            const ix = await createLockEscrowIx(
                connection,
                lockDammV1LpTokenParam.payer,
                dammPool,
                lpMint,
                virtualPoolState.creator,
                lockEscrowKey,
                dammV1Program
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
                lockDammV1LpTokenParam.payer,
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
            virtualPool,
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

        return program.methods
            .migrateMeteoraDammLockLpToken()
            .accountsStrict(accounts)
            .preInstructions(preInstructions)
            .transaction()
    }

    /**
     * Claim DAMM V1 LP token for creator or partner
     * @param connection - The connection to the Solana network
     * @param virtualPool - The virtual pool address
     * @param claimDammLpTokenParam - The parameters for the claim
     * @returns A claim transaction
     */
    async claimDammV1LpToken(
        connection: Connection,
        virtualPool: PublicKey,
        claimDammV1LpTokenParam: DammLpTokenParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const virtualPoolState = await this.programClient.getPool(
            connection,
            virtualPool
        )
        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${virtualPool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            connection,
            virtualPoolState.config
        )

        const poolAuthority = derivePoolAuthority(program.programId)

        const dammPool = derivePool(
            poolConfigState.quoteMint,
            virtualPoolState.baseMint,
            claimDammV1LpTokenParam.dammConfig,
            DAMM_V1_PROGRAM_ID
        )

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            claimDammV1LpTokenParam.virtualPool,
            DAMM_V1_PROGRAM_ID,
            false
        )

        const lpMint = deriveLpMintAddress(dammPool, DAMM_V1_PROGRAM_ID)

        const preInstructions: TransactionInstruction[] = []
        const destinationToken = getAssociatedTokenAddressSync(
            lpMint,
            claimDammV1LpTokenParam.payer,
            true,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )

        const createDestinationTokenIx =
            createAssociatedTokenAccountIdempotentInstruction(
                claimDammV1LpTokenParam.payer,
                destinationToken,
                claimDammV1LpTokenParam.payer,
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
            virtualPool,
            migrationMetadata,
            poolAuthority,
            pool: dammPool,
            lpMint,
            sourceToken,
            destinationToken,
            owner: virtualPoolState.creator,
            sender: claimDammV1LpTokenParam.payer,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        return program.methods
            .migrateMeteoraDammClaimLpToken()
            .accounts(accounts)
            .preInstructions(preInstructions)
            .transaction()
    }

    ///////////////////////
    // DAMM V2 FUNCTIONS //
    ///////////////////////

    /**
     * Migrate to DAMM V2
     * @param connection - The connection to the Solana network
     * @param virtualPool - The virtual pool address
     * @param migrateToDammV2Param - The parameters for the migration
     * @returns A migrate transaction
     */
    async migrateToDammV2(
        connection: Connection,
        virtualPool: PublicKey,
        migrateToDammV2Param: MigrateToDammV2Param
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const virtualPoolState = await this.programClient.getPool(
            connection,
            virtualPool
        )
        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${virtualPool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            connection,
            virtualPoolState.config
        )

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            migrateToDammV2Param.virtualPool,
            program.programId,
            true
        )

        const poolAuthority = derivePoolAuthority(DAMM_V2_PROGRAM_ID)
        const dammPoolAuthority = derivePoolAuthority(DAMM_V2_PROGRAM_ID)
        const dammEventAuthority = deriveDammV2EventAuthority()

        const dammPool = derivePool(
            poolConfigState.quoteMint,
            virtualPoolState.baseMint,
            migrateToDammV2Param.dammConfig,
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

        return program.methods
            .migrationDammV2()
            .accountsStrict({
                virtualPool: migrateToDammV2Param.virtualPool,
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
                payer: migrateToDammV2Param.payer,
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
                    pubkey: migrateToDammV2Param.dammConfig,
                },
            ])
            .transaction()
    }
}

/**
 * Main client class
 */
export class VirtualCurveClient {
    private programClient: VirtualCurveProgramClient
    public pools: PoolService
    public partners: PartnerService
    public migrations: MigrationService

    constructor(connection: Connection) {
        this.programClient = new VirtualCurveProgramClient(connection)
        this.pools = new PoolService(this.programClient)
        this.partners = new PartnerService(this.programClient)
        this.migrations = new MigrationService(this.programClient)
    }

    /**
     * Get the underlying program client
     * @returns The program client
     */
    getProgramClient(): VirtualCurveProgramClient {
        return this.programClient
    }

    /**
     * Static method to create a client instance for a specific pool
     * This is provided for backward compatibility with the old API
     * @param connection - The connection to the Solana network
     * @param pool - The public key of the pool
     * @returns A VirtualCurveClient instance
     */
    static async create(connection: Connection): Promise<VirtualCurveClient> {
        const client = new VirtualCurveClient(connection)
        return client
    }
}
