import {
    type MeteoraDammMigrationMetadata,
    type PoolConfig,
    type VirtualPool,
    type PartnerMetadata,
    type VirtualPoolMetadata,
    type LockEscrow,
    TokenType,
    MeteoraDammV2MigrationMetadata,
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
import {
    COMMITMENT,
    DAMM_V1_PROGRAM_ID,
    DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from './constants'
import {
    deriveDammPoolAddress,
    deriveDammV2PoolAddress,
    deriveLockEscrowAddress,
    derivePool,
} from './derive'
import {
    getMint,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import BN from 'bn.js'
import { PartnerService } from './services/partner'
import { CreatorService } from './services/creator'

export class DynamicBondingCurveClient {
    private program: Program<DynamicBondingCurveIDL>
    public pool: PoolService
    public migration: MigrationService
    public partner: PartnerService
    public creator: CreatorService

    constructor(connection: Connection) {
        const { program } = createProgram(connection)
        this.program = program
        this.pool = new PoolService(this)
        this.migration = new MigrationService(this)
        this.partner = new PartnerService(this)
        this.creator = new CreatorService(this)
    }

    /**
     * Get the Dynamic Bonding Curve program instance
     * @returns The Dynamic Bonding Curve program instance
     */
    getProgram(): Program<DynamicBondingCurveIDL> {
        return this.program
    }

    /**
     * Get config key details
     * @param configAddress - The address of the config key
     * @returns A config key account
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
     * Retrieve all config keys
     * @returns An array of config key accounts
     */
    async getPoolConfigs(): Promise<
        (ProgramAccount<PoolConfig> & { createdAt?: Date })[]
    > {
        const poolConfigs = await this.program.account.poolConfig.all()

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
     * Retrieve all config keys of an owner wallet address
     * @param owner - The owner of the config keys
     * @returns An array of config key accounts
     */
    async getPoolConfigsByOwner(
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
     * Get token decimals for a particular mint
     * @param mintAddress - The mint address to get decimals for
     * @param tokenType - The token type (SPL = 0 or Token2022 = 1)
     * @returns The number of decimals for the token
     */
    async getTokenDecimals(
        mintAddress: PublicKey | string,
        tokenType: TokenType
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
     * Get Dynamic Bonding Curve pool address
     * @param quoteMint - The quote mint
     * @param baseMint - The base mint
     * @param config - The config
     * @returns The pool address
     */
    async getDbcPoolAddress(
        quoteMint: PublicKey,
        baseMint: PublicKey,
        config: PublicKey
    ): Promise<PublicKey> {
        return derivePool(
            quoteMint,
            baseMint,
            config,
            DYNAMIC_BONDING_CURVE_PROGRAM_ID
        )
    }

    /**
     * Get DAMM V1 pool address
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
        return deriveDammPoolAddress(config, baseMint, quoteMint)
    }

    /**
     * Get DAMM V2 pool address
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
        return deriveDammV2PoolAddress(config, baseMint, quoteMint)
    }

    /**
     * Get dynamic bonding curve pool details
     * @param poolAddress - The address of the DBC pool
     * @returns A virtualPool account
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
     * Retrieves all dynamic bonding curve pools
     * @returns Array of pool accounts with their addresses
     */
    async getPools(): Promise<
        (ProgramAccount<VirtualPool> & { createdAt?: Date })[]
    > {
        const pools = await this.program.account.virtualPool.all()

        const signaturePromises = pools.map(async (pool) => {
            const signatures =
                await this.program.provider.connection.getSignaturesForAddress(
                    pool.publicKey,
                    { limit: 1 },
                    COMMITMENT
                )
            return signatures[0]?.blockTime
                ? new Date(signatures[0].blockTime * 1000)
                : undefined
        })

        const timestamps = await Promise.all(signaturePromises)

        return pools.map((pool, index) => ({
            ...pool,
            createdAt: timestamps[index],
        }))
    }

    /**
     * Retrieves all dynamic bonding curve pools by config key address
     * @param configAddress - The address of the config key
     * @returns Array of pool accounts with their addresses
     */
    async getPoolsByConfig(
        configAddress: PublicKey | string
    ): Promise<(ProgramAccount<VirtualPool> & { createdAt?: Date })[]> {
        const filters = createProgramAccountFilter(configAddress, 72)
        const pools = await this.program.account.virtualPool.all(filters)

        const signaturePromises = pools.map(async (pool) => {
            const signatures =
                await this.program.provider.connection.getSignaturesForAddress(
                    pool.publicKey,
                    { limit: 1 },
                    COMMITMENT
                )
            return signatures[0]?.blockTime
                ? new Date(signatures[0].blockTime * 1000)
                : undefined
        })

        const timestamps = await Promise.all(signaturePromises)

        return pools.map((pool, index) => ({
            ...pool,
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
     * Get the progress of the curve by comparing current quote reserve to migration threshold
     * @param poolAddress - The address of the pool
     * @returns The progress as a ratio between 0 and 1
     */
    async getPoolCurveProgress(
        poolAddress: PublicKey | string
    ): Promise<number> {
        const pool = await this.getPool(poolAddress)
        if (!pool) {
            throw new Error(`Pool not found: ${poolAddress.toString()}`)
        }

        const config = await this.getPoolConfig(pool.config)
        const quoteReserve = pool.quoteReserve
        const migrationThreshold = config.migrationQuoteThreshold

        const quoteReserveNum = quoteReserve.toNumber()
        const thresholdNum = migrationThreshold.toNumber()

        const progress = quoteReserveNum / thresholdNum

        return Math.min(Math.max(progress, 0), 1)
    }

    /**
     * Get pool metadata
     * @param poolAddress - The address of the pool
     * @returns A pool metadata
     */
    async getPoolMetadata(
        poolAddress: PublicKey | string
    ): Promise<VirtualPoolMetadata[]> {
        const filters = createProgramAccountFilter(poolAddress, 8)
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
        walletAddress: PublicKey | string
    ): Promise<PartnerMetadata[]> {
        const filters = createProgramAccountFilter(walletAddress, 8)
        const accounts = await this.program.account.partnerMetadata.all(filters)
        return accounts.map((account) => account.account)
    }

    /**
     * Get DAMM V1 lock escrow address
     * @param dammPool - The address of the DAMM V1 pool (on DAMM V1)
     * @param walletAddress - The wallet address of the creator / partner
     * @returns The lock escrow address
     */
    async getLockEscrowAddress(
        dammPool: PublicKey,
        walletAddress: PublicKey
    ): Promise<PublicKey> {
        return deriveLockEscrowAddress(
            dammPool,
            walletAddress,
            DAMM_V1_PROGRAM_ID
        )
    }

    /**
     * Get DAMM V1 lock escrow details
     * @param lockEscrowAddress - The address of the lock escrow
     * @returns A lock escrow account
     */
    async getDammV1LockEscrow(
        lockEscrowAddress: PublicKey | string
    ): Promise<LockEscrow> {
        const metadata = await this.program.account.lockEscrow.fetch(
            lockEscrowAddress instanceof PublicKey
                ? lockEscrowAddress
                : new PublicKey(lockEscrowAddress)
        )

        return metadata
    }

    /**
     * Get DAMM V1 migration metadata
     * @param poolAddress - The address of the DAMM V1 pool (on DBC)
     * @returns A DAMM V1 migration metadata
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
     * Get DAMM V2 migration metadata
     * @param poolAddress - The address of the DAMM V2 pool (on DBC)
     * @returns A DAMM V2 migration metadata
     */
    async getDammV2MigrationMetadata(
        poolAddress: PublicKey | string
    ): Promise<MeteoraDammV2MigrationMetadata> {
        const metadata = await this.program.account.meteoraDammV2Metadata.fetch(
            poolAddress instanceof PublicKey
                ? poolAddress
                : new PublicKey(poolAddress)
        )

        return metadata
    }

    /**
     * Get fee metrics for a specific pool
     * @param poolAddress - The address of the pool
     * @returns Object containing current and total fee metrics
     */
    async getPoolFeeMetrics(poolAddress: PublicKey): Promise<{
        current: {
            partnerBaseFee: BN
            partnerQuoteFee: BN
            creatorBaseFee: BN
            creatorQuoteFee: BN
        }
        total: {
            totalTradingBaseFee: BN
            totalTradingQuoteFee: BN
        }
    }> {
        const pool = await this.getPool(poolAddress)
        if (!pool) {
            throw new Error(`Pool not found: ${poolAddress.toString()}`)
        }

        return {
            current: {
                partnerBaseFee: pool.partnerBaseFee,
                partnerQuoteFee: pool.partnerQuoteFee,
                creatorBaseFee: pool.creatorBaseFee,
                creatorQuoteFee: pool.creatorQuoteFee,
            },
            total: {
                totalTradingBaseFee: pool.metrics.totalTradingBaseFee,
                totalTradingQuoteFee: pool.metrics.totalTradingQuoteFee,
            },
        }
    }

    /**
     * Get fee metrics for a specific pool
     * @param poolAddress - The address of the pool
     * @returns Object containing current and total fee metrics
     */
    async getPoolCreatorFeeMetrics(poolAddress: PublicKey): Promise<{
        creatorBaseFee: BN
        creatorQuoteFee: BN
    }> {
        const pool = await this.getPool(poolAddress)
        if (!pool) {
            throw new Error(`Pool not found: ${poolAddress.toString()}`)
        }

        return {
            creatorBaseFee: pool.creatorBaseFee,
            creatorQuoteFee: pool.creatorQuoteFee,
        }
    }

    /**
     * Get fee metrics for a specific pool
     * @param poolAddress - The address of the pool
     * @returns Object containing current and total fee metrics
     */
    async getPoolPartnerFeeMetrics(poolAddress: PublicKey): Promise<{
        partnerBaseFee: BN
        partnerQuoteFee: BN
    }> {
        const pool = await this.getPool(poolAddress)
        if (!pool) {
            throw new Error(`Pool not found: ${poolAddress.toString()}`)
        }

        return {
            partnerBaseFee: pool.partnerBaseFee,
            partnerQuoteFee: pool.partnerQuoteFee,
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
            partnerQuoteFee: BN
            creatorQuoteFee: BN
            totalTradingQuoteFee: BN
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
            partnerQuoteFee: pool.account.partnerQuoteFee,
            creatorQuoteFee: pool.account.creatorQuoteFee,
            totalTradingQuoteFee: pool.account.metrics.totalTradingQuoteFee,
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
            partnerBaseFee: BN
            creatorBaseFee: BN
            totalTradingBaseFee: BN
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
            partnerBaseFee: pool.account.partnerBaseFee,
            creatorBaseFee: pool.account.creatorBaseFee,
            totalTradingBaseFee: pool.account.metrics.totalTradingBaseFee,
        }))
    }
}
