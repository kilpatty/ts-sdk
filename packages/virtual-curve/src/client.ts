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
    type PartnerMetadata,
    type CreateVirtualPoolMetadataParam,
    type CreateVirtualPoolMetadataParameters,
    type VirtualPoolMetadata,
    type CreateLockerParam,
    type DesignPumpFunCurveParam,
    type DesignPumpFunCurveWithoutLockVestingParam,
    type ConfigParameters,
    type WithdrawLeftoverParam,
    type LockEscrow,
} from './types'
import {
    ComputeBudgetProgram,
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
    deriveDammPoolAddress,
    deriveDammV2EventAuthority,
    deriveDammV2PoolAddress,
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
    getVaultPdas,
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
    VIRTUAL_CURVE_PROGRAM_ID,
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
    createInitializePermissionlessDynamicVaultIx,
    createLockEscrowIx,
    prepareSwapParams,
} from './common'
import {
    designPumpFunCurve,
    designPumpFunCurveWithoutLockVesting,
} from './design'
import type { DynamicVault } from './idl/dynamic-vault/idl'
import type { DammV1 } from './idl/damm-v1/idl'

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
     * @param poolAddress - The address of the pool
     * @returns A virtual pool or null if not found
     */
    async getPool(
        poolAddress: PublicKey | string
    ): Promise<VirtualPool | null> {
        return getAccountData<VirtualPool>(
            poolAddress,
            'virtualPool',
            this.program
        )
    }

    /**
     * Retrieves all virtual pools
     * @returns Array of pool accounts with their addresses
     */
    async getPools(): Promise<ProgramAccount<VirtualPool>[]> {
        return await this.program.account.virtualPool.all()
    }

    /**
     * Get pool config (partner config)
     * @param configAddress - The address of the pool config key
     * @returns A pool config
     */
    async getPoolConfig(
        configAddress: PublicKey | string
    ): Promise<PoolConfig> {
        return getAccountData<PoolConfig>(
            configAddress,
            'poolConfig',
            this.program
        )
    }

    /**
     * Get pool migration quote threshold
     * @param poolAddress - The address of the pool
     * @returns The migration quote threshold
     */
    async getPoolMigrationQuoteThreshold(
        poolAddress: PublicKey | string
    ): Promise<BN> {
        const pool = await this.getPool(poolAddress)
        if (!pool) {
            throw new Error(`Pool not found: ${poolAddress.toString()}`)
        }
        const configAddress = pool.config
        const config = await this.getPoolConfig(configAddress)
        return config.migrationQuoteThreshold
    }

    /**
     * Retrieve all pool config keys (list of all configs owned by partner)
     * @param owner - The owner of the pool configs
     * @returns An array of pool configs
     */
    async getPoolConfigs(
        owner?: PublicKey | string
    ): Promise<(ProgramAccount<PoolConfig> & { createdAt?: Date })[]> {
        const filters = owner ? createProgramAccountFilter(owner, 72) : []
        const poolConfigs = await this.program.account.poolConfig.all(filters)

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

        return poolConfigs.map((config, index) => ({
            ...config,
            createdAt: timestamps[index],
        }))
    }

    /**
     * Get virtual pool metadata
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
     * Get partner metadata
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
    async swap(pool: PublicKey, swapParam: SwapParam): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const virtualPoolState = await this.programClient.getPool(pool)
        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${pool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
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
     * @param createConfigParam - The parameters for the config
     * @returns A new config
     */
    async createConfig(
        createConfigParam: CreateConfigParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const {
            config,
            feeClaimer,
            leftoverReceiver,
            quoteMint,
            payer,
            ...configParam
        } = createConfigParam

        const eventAuthority = deriveEventAuthority()

        const accounts = {
            config,
            feeClaimer,
            leftoverReceiver,
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
     * Create a new pump fun config
     * @param designPumpFunCurveParams - The parameters for the pump fun config
     * @returns A new pump fun config
     */
    async createPumpFunConfigWithLockVesting(
        designPumpFunCurveParams: DesignPumpFunCurveParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const {
            totalTokenSupply,
            percentageSupplyOnMigration,
            percentageSupplyVesting,
            frequency,
            numberOfPeriod,
            startPrice,
            migrationPrice,
            tokenBaseDecimal,
            tokenQuoteDecimal,
            feeClaimer,
            leftoverReceiver,
            payer,
            quoteMint,
            config,
        } = designPumpFunCurveParams

        const eventAuthority = deriveEventAuthority()

        const pumpFunCurveConfig: ConfigParameters = designPumpFunCurve(
            totalTokenSupply,
            percentageSupplyOnMigration,
            percentageSupplyVesting,
            frequency,
            numberOfPeriod,
            startPrice,
            migrationPrice,
            tokenBaseDecimal,
            tokenQuoteDecimal
        )

        const accounts = {
            config,
            feeClaimer,
            leftoverReceiver,
            quoteMint,
            payer,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .createConfig(pumpFunCurveConfig)
            .accounts(accounts)
            .transaction()
    }

    /**
     * Create a new pump fun config without lock vesting
     * @param designPumpFunCurveWithoutLockVestingParams - The parameters for the pump fun config without lock vesting
     * @returns A new pump fun config without lock vesting
     */
    async createPumpFunConfigWithoutLockVesting(
        designPumpFunCurveWithoutLockVestingParams: DesignPumpFunCurveWithoutLockVestingParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const {
            totalTokenSupply,
            percentageSupplyOnMigration,
            startPrice,
            tokenBaseDecimal,
            tokenQuoteDecimal,
            feeClaimer,
            leftoverReceiver,
            payer,
            quoteMint,
            config,
        } = designPumpFunCurveWithoutLockVestingParams

        const eventAuthority = deriveEventAuthority()

        const pumpFunCurveWithoutLockVestingConfig: ConfigParameters =
            designPumpFunCurveWithoutLockVesting(
                totalTokenSupply,
                percentageSupplyOnMigration,
                startPrice,
                tokenBaseDecimal,
                tokenQuoteDecimal
            )

        const accounts = {
            config,
            feeClaimer,
            leftoverReceiver,
            quoteMint,
            payer,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .createConfig(pumpFunCurveWithoutLockVestingConfig)
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
     * @param claimTradingFeeParam - The parameters for the claim trading fee
     * @param connection - The connection to the Solana network
     * @returns A claim trading fee transaction
     */
    async claimTradingFee(
        claimTradingFeeParam: ClaimTradingFeeParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const poolAuthority = derivePoolAuthority(program.programId)
        const eventAuthority = deriveEventAuthority()

        const virtualPoolState = await this.programClient.getPool(
            claimTradingFeeParam.pool
        )

        if (!virtualPoolState) {
            throw new Error(
                `Pool not found: ${claimTradingFeeParam.pool.toString()}`
            )
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        const tokenBaseProgram =
            poolConfigState.tokenType === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const tokenQuoteProgram =
            poolConfigState.quoteTokenFlag === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const tokenBaseAccount = findAssociatedTokenAddress(
            claimTradingFeeParam.feeClaimer,
            virtualPoolState.baseMint,
            tokenBaseProgram
        )

        const tokenQuoteAccount = findAssociatedTokenAddress(
            claimTradingFeeParam.feeClaimer,
            poolConfigState.quoteMint,
            tokenQuoteProgram
        )

        const preInstructions: TransactionInstruction[] = []
        const postInstructions: TransactionInstruction[] = []

        const createBaseTokenAccountIx =
            createAssociatedTokenAccountIdempotentInstruction(
                claimTradingFeeParam.feeClaimer,
                tokenBaseAccount,
                claimTradingFeeParam.feeClaimer,
                virtualPoolState.baseMint,
                tokenBaseProgram
            )

        if (createBaseTokenAccountIx) {
            preInstructions.push(createBaseTokenAccountIx)
        }

        const createQuoteTokenAccountIx =
            createAssociatedTokenAccountIdempotentInstruction(
                claimTradingFeeParam.feeClaimer,
                tokenQuoteAccount,
                claimTradingFeeParam.feeClaimer,
                poolConfigState.quoteMint,
                tokenQuoteProgram
            )

        if (createQuoteTokenAccountIx) {
            preInstructions.push(createQuoteTokenAccountIx)
        }

        const unwrapSolIx = unwrapSOLInstruction(
            claimTradingFeeParam.feeClaimer
        )

        if (unwrapSolIx) {
            postInstructions.push(unwrapSolIx)
        }

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
            tokenBaseProgram,
            tokenQuoteProgram,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .claimTradingFee(
                claimTradingFeeParam.maxBaseAmount,
                claimTradingFeeParam.maxQuoteAmount
            )
            .accounts(accounts)
            .preInstructions(preInstructions)
            .postInstructions(postInstructions)
            .transaction()
    }

    /**
     * Partner withdraw surplus
     * @param partnerWithdrawSurplusParam - The parameters for the partner withdraw surplus
     * @returns A partner withdraw surplus transaction
     */
    async partnerWithdrawSurplus(
        partnerWithdrawSurplusParam: PartnerWithdrawSurplusParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const poolAuthority = derivePoolAuthority(program.programId)
        const eventAuthority = deriveEventAuthority()

        const virtualPoolState = await this.programClient.getPool(
            partnerWithdrawSurplusParam.virtualPool
        )
        if (!virtualPoolState) {
            throw new Error(
                `Pool not found: ${partnerWithdrawSurplusParam.virtualPool.toString()}`
            )
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        const tokenQuoteProgram =
            poolConfigState.quoteTokenFlag === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const tokenQuoteAccount = findAssociatedTokenAddress(
            partnerWithdrawSurplusParam.feeClaimer,
            poolConfigState.quoteMint,
            tokenQuoteProgram
        )

        const preInstructions: TransactionInstruction[] = []
        const postInstructions: TransactionInstruction[] = []

        const createQuoteTokenAccountIx =
            createAssociatedTokenAccountIdempotentInstruction(
                partnerWithdrawSurplusParam.feeClaimer,
                tokenQuoteAccount,
                partnerWithdrawSurplusParam.feeClaimer,
                poolConfigState.quoteMint,
                tokenQuoteProgram
            )

        if (createQuoteTokenAccountIx) {
            preInstructions.push(createQuoteTokenAccountIx)
        }

        const unwrapSolIx = unwrapSOLInstruction(
            partnerWithdrawSurplusParam.feeClaimer
        )

        if (unwrapSolIx) {
            postInstructions.push(unwrapSolIx)
        }

        const accounts = {
            poolAuthority,
            config: virtualPoolState.config,
            virtualPool: partnerWithdrawSurplusParam.virtualPool,
            tokenQuoteAccount,
            quoteVault: virtualPoolState.quoteVault,
            quoteMint: poolConfigState.quoteMint,
            feeClaimer: partnerWithdrawSurplusParam.feeClaimer,
            tokenQuoteProgram,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .partnerWithdrawSurplus()
            .accounts(accounts)
            .preInstructions(preInstructions)
            .postInstructions(postInstructions)
            .transaction()
    }

    /**
     * Withdraw leftover
     * @param withdrawLeftoverParam - The parameters for the withdraw leftover
     * @returns A withdraw leftover transaction
     */
    async withdrawLeftover(
        withdrawLeftoverParam: WithdrawLeftoverParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const poolAuthority = derivePoolAuthority(program.programId)
        const eventAuthority = deriveEventAuthority()

        const virtualPoolState = await this.programClient.getPool(
            withdrawLeftoverParam.virtualPool
        )

        if (!virtualPoolState) {
            throw new Error(
                `Pool not found: ${withdrawLeftoverParam.virtualPool.toString()}`
            )
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        const tokenBaseProgram =
            poolConfigState.tokenType === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const tokenBaseAccount = findAssociatedTokenAddress(
            poolConfigState.leftoverReceiver,
            virtualPoolState.baseMint,
            tokenBaseProgram
        )

        const preInstructions: TransactionInstruction[] = []

        const createBaseTokenAccountIx =
            createAssociatedTokenAccountIdempotentInstruction(
                poolConfigState.leftoverReceiver,
                tokenBaseAccount,
                poolConfigState.leftoverReceiver,
                virtualPoolState.baseMint,
                tokenBaseProgram
            )

        if (createBaseTokenAccountIx) {
            preInstructions.push(createBaseTokenAccountIx)
        }

        const accounts = {
            poolAuthority,
            config: virtualPoolState.config,
            virtualPool: withdrawLeftoverParam.virtualPool,
            tokenBaseAccount,
            baseVault: virtualPoolState.baseVault,
            baseMint: virtualPoolState.baseMint,
            leftoverReceiver: poolConfigState.leftoverReceiver,
            tokenBaseProgram,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .withdrawLeftover()
            .accounts(accounts)
            .preInstructions(preInstructions)
            .transaction()
    }
}

/**
 * Migration-related operations
 */
export class MigrationService {
    private connection: Connection

    constructor(private programClient: VirtualCurveProgramClient) {
        this.connection = this.programClient.getProgram().provider.connection
    }

    /**
     * Get the vault program instance
     * @returns The vault program instance
     */
    private getVaultProgram(): Program<DynamicVault> {
        return createVaultProgram(this.connection)
    }

    /**
     * Get the DAMM V1 program instance
     * @returns The DAMM V1 program instance
     */
    private getDammV1Program(): Program<DammV1> {
        return createDammV1Program(this.connection)
    }

    /**
     * Create metadata for the migration of Meteora DAMM V1 or DAMM V2
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
     * @param createLockerParam - The parameters for the locker
     * @returns A create locker transaction
     */
    async createLocker(
        createLockerParam: CreateLockerParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const poolAuthority = derivePoolAuthority(program.programId)
        const lockerEventAuthority = deriveLockerEventAuthority()

        const virtualPoolState = await this.programClient.getPool(
            createLockerParam.virtualPool
        )

        if (!virtualPoolState) {
            throw new Error(
                `Pool not found: ${createLockerParam.virtualPool.toString()}`
            )
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        const base = deriveBaseKeyForLocker(createLockerParam.virtualPool)

        const escrow = deriveEscrow(base)

        const tokenProgram =
            poolConfigState.tokenType === 0
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const escrowToken = findAssociatedTokenAddress(
            escrow,
            virtualPoolState.baseMint,
            tokenProgram
        )

        const preInstructions: TransactionInstruction[] = []

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
     * Migrate to DAMM V1
     * @param migrateToDammV1Param - The parameters for the migration
     * @returns A migrate transaction
     */
    async migrateToDammV1(
        migrateToDammV1Param: MigrateToDammV1Param
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()

        const virtualPoolState = await this.programClient.getPool(
            migrateToDammV1Param.virtualPool
        )
        if (!virtualPoolState) {
            throw new Error(
                `Pool not found: ${migrateToDammV1Param.virtualPool.toString()}`
            )
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        const poolAuthority = derivePoolAuthority(program.programId)

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            migrateToDammV1Param.virtualPool,
            program.programId,
            false
        )

        const dammPool = deriveDammPoolAddress(
            migrateToDammV1Param.dammConfig,
            virtualPoolState.baseMint,
            poolConfigState.quoteMint
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

        const vaultProgram = this.getVaultProgram()

        const [
            {
                vaultPda: aVault,
                tokenVaultPda: aTokenVault,
                lpMintPda: aLpMintPda,
            },
            {
                vaultPda: bVault,
                tokenVaultPda: bTokenVault,
                lpMintPda: bLpMintPda,
            },
        ] = [
            getVaultPdas(virtualPoolState.baseMint, vaultProgram.programId),
            getVaultPdas(poolConfigState.quoteMint, vaultProgram.programId),
        ]

        const [aVaultAccount, bVaultAccount] = await Promise.all([
            vaultProgram.account.vault.fetchNullable(aVault),
            vaultProgram.account.vault.fetchNullable(bVault),
        ])

        let aVaultLpMint = aLpMintPda
        let bVaultLpMint = bLpMintPda
        const preInstructions: TransactionInstruction[] = []

        if (!aVaultAccount) {
            const createVaultAIx =
                await createInitializePermissionlessDynamicVaultIx(
                    virtualPoolState.baseMint,
                    migrateToDammV1Param.payer,
                    vaultProgram
                )
            if (createVaultAIx) {
                preInstructions.push(createVaultAIx.instruction)
            }
        } else {
            aVaultLpMint = aVaultAccount.lpMint
        }
        if (!bVaultAccount) {
            const createVaultBIx =
                await createInitializePermissionlessDynamicVaultIx(
                    poolConfigState.quoteMint,
                    migrateToDammV1Param.payer,
                    vaultProgram
                )
            if (createVaultBIx) {
                preInstructions.push(createVaultBIx.instruction)
            }
        } else {
            bVaultLpMint = bVaultAccount.lpMint
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

        const transaction = await program.methods
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

        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
            units: 500000,
        })

        transaction.add(modifyComputeUnits)

        return transaction
    }

    /**
     * Lock DAMM V1 LP token for creator or partner
     * @param lockDammV1LpTokenParam - The parameters for the lock
     * @returns A lock transaction
     */
    async lockDammV1LpToken(
        lockDammV1LpTokenParam: DammLpTokenParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const poolAuthority = derivePoolAuthority(program.programId)

        const virtualPoolState = await this.programClient.getPool(
            lockDammV1LpTokenParam.virtualPool
        )

        if (!virtualPoolState) {
            throw new Error(
                `Pool not found: ${lockDammV1LpTokenParam.virtualPool.toString()}`
            )
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        const dammPool = deriveDammPoolAddress(
            lockDammV1LpTokenParam.dammConfig,
            virtualPoolState.baseMint,
            poolConfigState.quoteMint
        )

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            lockDammV1LpTokenParam.virtualPool,
            VIRTUAL_CURVE_PROGRAM_ID,
            false
        )

        const vaultProgram = this.getVaultProgram()

        const [
            { vaultPda: aVault, lpMintPda: aLpMintPda },
            { vaultPda: bVault, lpMintPda: bLpMintPda },
        ] = [
            getVaultPdas(virtualPoolState.baseMint, vaultProgram.programId),
            getVaultPdas(poolConfigState.quoteMint, vaultProgram.programId),
        ]

        const [aVaultAccount, bVaultAccount] = await Promise.all([
            vaultProgram.account.vault.fetchNullable(aVault),
            vaultProgram.account.vault.fetchNullable(bVault),
        ])

        let aVaultLpMint = aLpMintPda
        let bVaultLpMint = bLpMintPda
        const preInstructions: TransactionInstruction[] = []

        if (!aVaultAccount) {
            const createVaultAIx =
                await createInitializePermissionlessDynamicVaultIx(
                    virtualPoolState.baseMint,
                    lockDammV1LpTokenParam.payer,
                    vaultProgram
                )
            if (createVaultAIx) {
                preInstructions.push(createVaultAIx.instruction)
            }
        } else {
            aVaultLpMint = aVaultAccount.lpMint
        }
        if (!bVaultAccount) {
            const createVaultBIx =
                await createInitializePermissionlessDynamicVaultIx(
                    poolConfigState.quoteMint,
                    lockDammV1LpTokenParam.payer,
                    vaultProgram
                )
            if (createVaultBIx) {
                preInstructions.push(createVaultBIx.instruction)
            }
        } else {
            bVaultLpMint = bVaultAccount.lpMint
        }

        const [aVaultLp, bVaultLp] = [
            deriveVaultLPAddress(aVault, dammPool, DAMM_V1_PROGRAM_ID),
            deriveVaultLPAddress(bVault, dammPool, DAMM_V1_PROGRAM_ID),
        ]

        const lpMint = deriveLpMintAddress(dammPool, DAMM_V1_PROGRAM_ID)

        const dammV1Program = this.getDammV1Program()

        const dammV1MigrationMetadata =
            await this.getDammV1MigrationMetadata(migrationMetadata)

        let lockEscrowKey: PublicKey

        if (lockDammV1LpTokenParam.isPartner) {
            lockEscrowKey = deriveLockEscrowAddress(
                dammPool,
                dammV1MigrationMetadata.partner,
                DAMM_V1_PROGRAM_ID
            )

            const lockEscrowData =
                await this.connection.getAccountInfo(lockEscrowKey)

            if (!lockEscrowData) {
                const ix = await createLockEscrowIx(
                    this.connection,
                    lockDammV1LpTokenParam.payer,
                    dammPool,
                    lpMint,
                    dammV1MigrationMetadata.partner,
                    lockEscrowKey,
                    dammV1Program
                )
                preInstructions.push(ix)
            }
        } else {
            lockEscrowKey = deriveLockEscrowAddress(
                dammPool,
                virtualPoolState.creator,
                DAMM_V1_PROGRAM_ID
            )

            console.log('lockEscrowKey', lockEscrowKey)

            const lockEscrowData =
                await this.connection.getAccountInfo(lockEscrowKey)

            if (!lockEscrowData) {
                const ix = await createLockEscrowIx(
                    this.connection,
                    lockDammV1LpTokenParam.payer,
                    dammPool,
                    lpMint,
                    virtualPoolState.creator,
                    lockEscrowKey,
                    dammV1Program
                )
                preInstructions.push(ix)
            }
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
            virtualPool: lockDammV1LpTokenParam.virtualPool,
            migrationMetadata,
            poolAuthority,
            pool: dammPool,
            lpMint,
            lockEscrow: lockEscrowKey,
            owner: lockDammV1LpTokenParam.isPartner
                ? dammV1MigrationMetadata.partner
                : virtualPoolState.creator,
            sender: lockDammV1LpTokenParam.payer,
            sourceTokens,
            escrowVault,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            aVault,
            bVault,
            aVaultLp,
            bVaultLp,
            aVaultLpMint,
            bVaultLpMint,
            ammProgram: DAMM_V1_PROGRAM_ID,
            vaultProgram: VAULT_PROGRAM_ID,
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
     * @param claimDammV1LpTokenParam - The parameters for the claim
     * @returns A claim transaction
     */
    async claimDammV1LpToken(
        claimDammV1LpTokenParam: DammLpTokenParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const poolAuthority = derivePoolAuthority(program.programId)

        const virtualPoolState = await this.programClient.getPool(
            claimDammV1LpTokenParam.virtualPool
        )

        if (!virtualPoolState) {
            throw new Error(
                `Pool not found: ${claimDammV1LpTokenParam.virtualPool.toString()}`
            )
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        const dammPool = deriveDammPoolAddress(
            claimDammV1LpTokenParam.dammConfig,
            virtualPoolState.baseMint,
            poolConfigState.quoteMint
        )

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            claimDammV1LpTokenParam.virtualPool,
            VIRTUAL_CURVE_PROGRAM_ID,
            false
        )

        const lpMint = deriveLpMintAddress(dammPool, DAMM_V1_PROGRAM_ID)

        console.log('lpMint', lpMint.toString())

        const destinationToken = findAssociatedTokenAddress(
            claimDammV1LpTokenParam.payer,
            lpMint,
            TOKEN_PROGRAM_ID
        )

        const preInstructions: TransactionInstruction[] = []

        const createDestinationTokenIx =
            createAssociatedTokenAccountIdempotentInstruction(
                claimDammV1LpTokenParam.payer,
                destinationToken,
                claimDammV1LpTokenParam.payer,
                lpMint,
                TOKEN_PROGRAM_ID
            )

        preInstructions.push(createDestinationTokenIx)

        const sourceToken = getAssociatedTokenAddressSync(
            lpMint,
            poolAuthority,
            true
        )

        const accounts = {
            virtualPool: claimDammV1LpTokenParam.virtualPool,
            migrationMetadata,
            poolAuthority,
            lpMint,
            sourceToken,
            destinationToken,
            owner: claimDammV1LpTokenParam.isPartner
                ? poolConfigState.feeClaimer
                : virtualPoolState.creator,
            sender: claimDammV1LpTokenParam.payer,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        return program.methods
            .migrateMeteoraDammClaimLpToken()
            .accountsPartial(accounts)
            .preInstructions(preInstructions)
            .transaction()
    }

    /**
     * Get DAMM V1 migration metadata
     * @param metadataAddress - The address of the meteora DAMM migration metadata
     * @returns A meteora DAMM migration metadata
     */
    async getDammV1MigrationMetadata(
        poolAddress: PublicKey | string
    ): Promise<MeteoraDammMigrationMetadata> {
        const program = this.programClient.getProgram()
        const metadata =
            await program.account.meteoraDammMigrationMetadata.fetch(
                poolAddress instanceof PublicKey
                    ? poolAddress
                    : new PublicKey(poolAddress)
            )

        return metadata
    }

    /**
     * Get DAMM V1 migration metadata
     * @param walletAddress - The address of the meteora DAMM migration metadata
     * @returns A meteora DAMM migration metadata
     */
    async getLockedLpTokenAmount(
        walletAddress: PublicKey | string
    ): Promise<LockEscrow> {
        const program = this.programClient.getProgram()
        const metadata = await program.account.lockEscrow.fetch(
            walletAddress instanceof PublicKey
                ? walletAddress
                : new PublicKey(walletAddress)
        )

        return metadata
    }

    ///////////////////////
    // DAMM V2 FUNCTIONS //
    ///////////////////////

    /**
     * Migrate to DAMM V2
     * @param migrateToDammV2Param - The parameters for the migration
     * @returns A migrate transaction
     */
    async migrateToDammV2(migrateToDammV2Param: MigrateToDammV2Param): Promise<{
        transaction: Transaction
        firstPositionNftKeypair: Keypair
        secondPositionNftKeypair: Keypair
    }> {
        const program = this.programClient.getProgram()
        const poolAuthority = derivePoolAuthority(program.programId)
        const dammPoolAuthority = derivePoolAuthority(DAMM_V2_PROGRAM_ID)
        const dammEventAuthority = deriveDammV2EventAuthority()

        const virtualPoolState = await this.programClient.getPool(
            migrateToDammV2Param.virtualPool
        )

        if (!virtualPoolState) {
            throw new Error(
                `Pool not found: ${migrateToDammV2Param.virtualPool.toString()}`
            )
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        const migrationMetadata = deriveDammMigrationMetadataAddress(
            migrateToDammV2Param.virtualPool,
            program.programId,
            true
        )

        const dammPool = deriveDammV2PoolAddress(
            migrateToDammV2Param.dammConfig,
            virtualPoolState.baseMint,
            poolConfigState.quoteMint
        )

        const firstPositionNftKP = Keypair.generate()
        const firstPosition = derivePositionAddress(
            firstPositionNftKP.publicKey
        )
        const firstPositionNftAccount = derivePositionNftAccount(
            firstPositionNftKP.publicKey
        )

        const secondPositionNftKP = Keypair.generate()
        const secondPosition = derivePositionAddress(
            secondPositionNftKP.publicKey
        )
        const secondPositionNftAccount = derivePositionNftAccount(
            secondPositionNftKP.publicKey
        )

        const tokenAVault = deriveTokenVaultAddress(
            dammPool,
            virtualPoolState.baseMint,
            DAMM_V2_PROGRAM_ID
        )

        const tokenBVault = deriveTokenVaultAddress(
            dammPool,
            poolConfigState.quoteMint,
            DAMM_V2_PROGRAM_ID
        )

        const tokenBaseProgram =
            poolConfigState.tokenType == 0
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const tokenQuoteProgram =
            poolConfigState.quoteTokenFlag == 0
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const tx = await program.methods
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

        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
            units: 500000,
        })

        tx.add(modifyComputeUnits)

        return {
            transaction: tx,
            firstPositionNftKeypair: firstPositionNftKP,
            secondPositionNftKeypair: secondPositionNftKP,
        }
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
     * @param connection - The connection to the Solana network
     * @returns A VirtualCurveClient instance
     */
    static async create(connection: Connection): Promise<VirtualCurveClient> {
        const client = new VirtualCurveClient(connection)
        return client
    }
}
