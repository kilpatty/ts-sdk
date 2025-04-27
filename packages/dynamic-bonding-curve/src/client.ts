import {
    type MeteoraDammMigrationMetadata,
    type PoolConfig,
    type VirtualPool,
    type PartnerMetadata,
    type VirtualPoolMetadata,
    type LockEscrow,
    TokenType,
} from './types'
import { Connection, PublicKey } from '@solana/web3.js'
import {
    createProgram,
    getAccountData,
    createProgramAccountFilter,
} from './utils'
import type { Program, ProgramAccount } from '@coral-xyz/anchor'
import type { DynamicBondingCurve as DynamicBondingCurveIDL } from './idl/dynamic-bonding-curve/idl'
import { PoolService } from './services/pool'
import { MigrationService } from './services/migration'
import { PartnerService } from './services/partner'
import { COMMITMENT } from './constants'
import {
    deriveDammPoolAddress,
    deriveDammV2PoolAddress,
    derivePool,
} from './derive'
import {
    getMint,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import BN from 'bn.js'

export class DynamicBondingCurveProgramClient {
    private program: Program<DynamicBondingCurveIDL>

    constructor(connection: Connection) {
        const { program } = createProgram(connection)
        this.program = program
    }

    /**
     * Get the underlying program instance
     * @returns The program instance
     */
    getProgram(): Program<DynamicBondingCurveIDL> {
        return this.program
    }

    /**
     * Get the Dynamic Bonding Curve pool address
     * @param quoteMint - The quote mint
     * @param baseMint - The base mint
     * @param config - The config
     * @returns The pool address
     */
    async getDBCPoolAddress(
        quoteMint: PublicKey,
        baseMint: PublicKey,
        config: PublicKey
    ): Promise<PublicKey> {
        return derivePool(quoteMint, baseMint, config, this.program.programId)
    }

    /**
     * Get the DAMM V1 pool address
     * @param quoteMint - The quote mint
     * @param baseMint - The base mint
     * @param config - The config
     * @returns The pool address
     */
    async getDammV1PoolAddress(
        quoteMint: PublicKey,
        baseMint: PublicKey,
        config: PublicKey
    ): Promise<PublicKey> {
        return deriveDammPoolAddress(quoteMint, baseMint, config)
    }

    /**
     * Get the DAMM V2 pool address
     * @param quoteMint - The quote mint
     * @param baseMint - The base mint
     * @param config - The config
     * @returns The pool address
     */
    async getDammV2PoolAddress(
        quoteMint: PublicKey,
        baseMint: PublicKey,
        config: PublicKey
    ): Promise<PublicKey> {
        return deriveDammV2PoolAddress(quoteMint, baseMint, config)
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
                    COMMITMENT
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
     * Get DAMM V1 migration metadata
     * @param poolAddress - The address of the meteora DAMM migration metadata
     * @returns A meteora DAMM migration metadata
     */
    async getDammV1MigrationMetadata(
        poolAddress: PublicKey | string
    ): Promise<MeteoraDammMigrationMetadata> {
        const metadata =
            await this.program.account.meteoraDammMigrationMetadata.fetch(
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
        const metadata = await this.program.account.lockEscrow.fetch(
            walletAddress instanceof PublicKey
                ? walletAddress
                : new PublicKey(walletAddress)
        )

        return metadata
    }

    /**
     * Get the progress of the curve by comparing current quote reserve to migration threshold
     * @param poolAddress - The address of the pool
     * @returns The progress as a ratio between 0 and 1
     */
    async getCurveProgress(poolAddress: PublicKey | string): Promise<number> {
        const pool = await this.getPool(poolAddress)
        if (!pool) {
            throw new Error(`Pool not found: ${poolAddress.toString()}`)
        }

        const config = await this.getPoolConfig(pool.config)
        const quoteReserve = pool.quoteReserve
        const migrationThreshold = config.migrationQuoteThreshold

        // Convert BN to number for calculation
        const quoteReserveNum = quoteReserve.toNumber()
        const thresholdNum = migrationThreshold.toNumber()

        // Calculate progress as a ratio
        const progress = quoteReserveNum / thresholdNum

        // Ensure progress is between 0 and 1
        return Math.min(Math.max(progress, 0), 1)
    }

    /**
     * Get token decimals for a particular mint
     * @param mintAddress - The mint address to get decimals for
     * @param tokenType - Optional token type (SPL or Token2022)
     * @returns The number of decimals for the token
     */
    async getTokenDecimals(
        mintAddress: PublicKey | string,
        tokenType?: TokenType
    ): Promise<number> {
        const mint =
            mintAddress instanceof PublicKey
                ? mintAddress
                : new PublicKey(mintAddress)

        const mintInfo = await getMint(
            this.program.provider.connection,
            mint,
            COMMITMENT,
            tokenType === TokenType.Token2022
                ? TOKEN_2022_PROGRAM_ID
                : TOKEN_PROGRAM_ID
        )
        return mintInfo.decimals
    }

    /**
     * Get fee metrics for a specific pool
     * @param poolAddress - The address of the pool
     * @returns Object containing current and total fee metrics
     */
    async getPoolFeeMetrics(poolAddress: PublicKey): Promise<{
        current: {
            tradingBaseFee: BN
            tradingQuoteFee: BN
            protocolBaseFee: BN
            protocolQuoteFee: BN
        }
        total: {
            totalTradingBaseFee: BN
            totalTradingQuoteFee: BN
            totalProtocolBaseFee: BN
            totalProtocolQuoteFee: BN
        }
    }> {
        const pool = await this.getPool(poolAddress)
        if (!pool) {
            throw new Error(`Pool not found: ${poolAddress.toString()}`)
        }

        return {
            current: {
                tradingBaseFee: pool.tradingBaseFee,
                tradingQuoteFee: pool.tradingQuoteFee,
                protocolBaseFee: pool.protocolBaseFee,
                protocolQuoteFee: pool.protocolQuoteFee,
            },
            total: {
                totalTradingBaseFee: pool.metrics.totalTradingBaseFee,
                totalTradingQuoteFee: pool.metrics.totalTradingQuoteFee,
                totalProtocolBaseFee: pool.metrics.totalProtocolBaseFee,
                totalProtocolQuoteFee: pool.metrics.totalProtocolQuoteFee,
            },
        }
    }

    /**
     * Get all quote fees for pools linked to a specific config key
     * @param configAddress - The address of the pool config
     * @returns Array of pools with their quote fees
     */
    async getPoolsQuoteFeesByConfig(configAddress: PublicKey): Promise<
        Array<{
            poolAddress: PublicKey
            tradingQuoteFee: BN
            protocolQuoteFee: BN
            totalTradingQuoteFee: BN
            totalProtocolQuoteFee: BN
        }>
    > {
        const config =
            configAddress instanceof PublicKey
                ? configAddress
                : new PublicKey(configAddress)

        const pools = await this.getPools()
        const filteredPools = pools.filter((pool) =>
            pool.account.config.equals(config)
        )

        return filteredPools.map((pool) => ({
            poolAddress: pool.publicKey,
            tradingQuoteFee: pool.account.tradingQuoteFee,
            protocolQuoteFee: pool.account.protocolQuoteFee,
            totalTradingQuoteFee: pool.account.metrics.totalTradingQuoteFee,
            totalProtocolQuoteFee: pool.account.metrics.totalProtocolQuoteFee,
        }))
    }

    /**
     * Get all base fees for pools linked to a specific config key
     * @param configAddress - The address of the pool config
     * @returns Array of pools with their base fees
     */
    async getPoolsBaseFeesByConfig(configAddress: PublicKey): Promise<
        Array<{
            poolAddress: PublicKey
            tradingBaseFee: BN
            protocolBaseFee: BN
            totalTradingBaseFee: BN
            totalProtocolBaseFee: BN
        }>
    > {
        const config =
            configAddress instanceof PublicKey
                ? configAddress
                : new PublicKey(configAddress)

        const pools = await this.getPools()
        const filteredPools = pools.filter((pool) =>
            pool.account.config.equals(config)
        )

        return filteredPools.map((pool) => ({
            poolAddress: pool.publicKey,
            tradingBaseFee: pool.account.tradingBaseFee,
            protocolBaseFee: pool.account.protocolBaseFee,
            totalTradingBaseFee: pool.account.metrics.totalTradingBaseFee,
            totalProtocolBaseFee: pool.account.metrics.totalProtocolBaseFee,
        }))
    }
}

/**
 * Main client class
 */
export class DynamicBondingCurveClient {
    private programClient: DynamicBondingCurveProgramClient
    public pools: PoolService
    public partners: PartnerService
    public migrations: MigrationService

    constructor(connection: Connection) {
        this.programClient = new DynamicBondingCurveProgramClient(connection)
        this.pools = new PoolService(this.programClient)
        this.partners = new PartnerService(this.programClient)
        this.migrations = new MigrationService(this.programClient)
    }

    /**
     * Get the underlying program client
     * @returns The program client
     */
    getProgramClient(): DynamicBondingCurveProgramClient {
        return this.programClient
    }

    /**
     * Static method to create a client instance for a specific pool
     * @param connection - The connection to the Solana network
     * @returns A DynamicBondingCurveClient instance
     */
    static async create(
        connection: Connection
    ): Promise<DynamicBondingCurveClient> {
        const client = new DynamicBondingCurveClient(connection)
        return client
    }
}
