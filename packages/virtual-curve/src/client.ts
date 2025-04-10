import {
    TokenType,
    type ClaimProtocolFeeParam,
    type ClaimTradingFeeParam,
    type CreateConfigParam,
    type CreatePoolParam,
    type InitializeVirtualPoolWithSplTokenAccounts,
    type InitializeVirtualPoolWithToken2022Accounts,
    type MeteoraDammMigrationMetadata,
    type MigrateMeteoraDammCreateMetadataParam,
    type MigrateMeteoraDammLockLpTokenForCreatorParam,
    type MigrateMeteoraDammLockLpTokenForPartnerParam,
    type MigrateMeteoraDammParam,
    type PoolConfigState,
    type SwapAccounts,
    type SwapParam,
    type VirtualCurveClientInterface,
    type VirtualPoolState,
} from './types'
import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
} from '@solana/web3.js'
import { VirtualCurve } from '.'
import {
    deriveEventAuthority,
    deriveMetadata,
    derivePool,
    derivePoolAuthority,
    deriveTokenVault,
} from './derive'
import {
    createAssociatedTokenAccountIdempotentInstruction,
    NATIVE_MINT,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { METADATA_PROGRAM_ID } from './constants'
import {
    createProgram,
    findAssociatedTokenAddress,
    unwrapSOLInstruction,
    wrapSOLInstruction,
} from './utils'
import type { Program } from '@coral-xyz/anchor'
import type { VirtualCurve as VirtualCurveIDL } from './idl/idl'
import BN from 'bn.js'

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
        const baseVault = deriveTokenVault(pool, baseMint, program.programId)
        const quoteVault = deriveTokenVault(pool, quoteMint, program.programId)
        const baseMetadata = deriveMetadata(baseMint, program.programId)

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
        const inputMint = swapParam.swapBaseForQuote
            ? new PublicKey(swapParam.baseMint)
            : new PublicKey(swapParam.quoteMint)
        const outputMint = swapParam.swapBaseForQuote
            ? new PublicKey(swapParam.quoteMint)
            : new PublicKey(swapParam.baseMint)

        const isSOLInput = inputMint.toString() === NATIVE_MINT.toString()
        const isSOLOutput = outputMint.toString() === NATIVE_MINT.toString()

        const inputTokenProgram = swapParam.swapBaseForQuote
            ? this.virtualPoolState.poolType === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID
            : this.poolConfigState.quoteTokenFlag === TokenType.SPL
              ? TOKEN_PROGRAM_ID
              : TOKEN_2022_PROGRAM_ID

        const outputTokenProgram = swapParam.swapBaseForQuote
            ? this.poolConfigState.quoteTokenFlag === TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID
            : this.virtualPoolState.poolType === TokenType.SPL
              ? TOKEN_PROGRAM_ID
              : TOKEN_2022_PROGRAM_ID

        const inputTokenAccount = findAssociatedTokenAddress(
            swapParam.user,
            inputMint,
            inputTokenProgram
        )

        const outputTokenAccount = findAssociatedTokenAddress(
            swapParam.user,
            outputMint,
            outputTokenProgram
        )

        const eventAuthority = deriveEventAuthority(this.program.programId)
        const poolAuthority = derivePoolAuthority(this.program.programId)

        const ixs = []
        const cleanupIxs = []
        if (isSOLInput) {
            ixs.push(
                createAssociatedTokenAccountIdempotentInstruction(
                    swapParam.user,
                    inputTokenAccount,
                    swapParam.user,
                    inputMint
                )
            )
            ixs.push(
                ...wrapSOLInstruction(
                    swapParam.user,
                    inputTokenAccount,
                    BigInt(swapParam.swapParams.amountIn.toString())
                )
            )
            cleanupIxs.push(unwrapSOLInstruction(swapParam.user))
        }

        ixs.push(
            createAssociatedTokenAccountIdempotentInstruction(
                swapParam.user,
                outputTokenAccount,
                swapParam.user,
                outputMint
            )
        )

        if (isSOLOutput) {
            cleanupIxs.push(unwrapSOLInstruction(swapParam.user))
        }

        const accounts: SwapAccounts = {
            ...swapParam,
            inputTokenAccount,
            outputTokenAccount,
            eventAuthority,
            poolAuthority,
            program: this.program.programId,
        }

        const transaction = await this.program.methods
            .swap(swapParam.swapParams)
            .accounts(accounts)
            .transaction()
        return transaction
    }

    /**
     * Claim protocol fee
     * @param connection - The connection to the Solana network
     * @param claimProtocolFeeParam - The parameters for the claim protocol fee
     * @returns A claim protocol fee transaction
     */
    static async claimProtocolFee(
        connection: Connection,
        claimProtocolFeeParam: ClaimProtocolFeeParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const eventAuthority = deriveEventAuthority(program.programId)
        const accounts = {
            ...claimProtocolFeeParam,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .claimProtocolFee()
            .accounts(accounts)
            .transaction()
    }

    /**
     * Claim trading fee
     * @param connection - The connection to the Solana network
     * @param claimTradingFeeParam - The parameters for the claim trading fee
     * @returns A claim trading fee transaction
     */
    static async claimTradingFee(
        connection: Connection,
        claimTradingFeeParam: ClaimTradingFeeParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const eventAuthority = deriveEventAuthority(program.programId)
        const accounts = {
            ...claimTradingFeeParam,
            eventAuthority,
            program: program.programId,
        }

        // Convert to BN if needed
        const amountA =
            claimTradingFeeParam.maxAccountA instanceof BN
                ? claimTradingFeeParam.maxAccountA
                : new BN(claimTradingFeeParam.maxAccountA.toString())
        const amountB =
            claimTradingFeeParam.maxAccountB instanceof BN
                ? claimTradingFeeParam.maxAccountB
                : new BN(claimTradingFeeParam.maxAccountB.toString())

        return program.methods
            .claimTradingFee(amountA, amountB)
            .accounts(accounts)
            .transaction()
    }

    /**
     * Create metadata for the migration of Meteora DAMM
     * @param connection - The connection to the Solana network
     * @param MigrateMeteoraDammCreateMetadataParam - The parameters for the migration
     * @returns A migration transaction
     */
    static async migrationMeteoraDammCreateMetadata(
        connection: Connection,
        MigrateMeteoraDammCreateMetadataParam: MigrateMeteoraDammCreateMetadataParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)

        return program.methods
            .migrationMeteoraDammCreateMetadata()
            .accounts({
                ...MigrateMeteoraDammCreateMetadataParam,
                program: program.programId,
            })
            .transaction()
    }

    /**
     * Migrate Meteora DAMM
     * @param connection - The connection to the Solana network
     * @param migrateMeteoraDammParam - The parameters for the migration
     * @returns A migration transaction
     */
    static async migrateMeteoraDamm(
        connection: Connection,
        migrateMeteoraDammParam: MigrateMeteoraDammParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const eventAuthority = deriveEventAuthority(program.programId)
        const accounts = {
            ...migrateMeteoraDammParam,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .migrateMeteoraDamm()
            .accounts(accounts)
            .transaction()
    }

    /**
     * Migrate Meteora DAMM lock LP token
     * @param connection - The connection to the Solana network
     * @param lockLpTokenParam - The parameters for the migration
     * @param isCreator - Whether the lock is for creator or partner
     * @returns A migration transaction
     */
    static async migrateMeteoraDammLockLpToken(
        connection: Connection,
        lockLpTokenParam:
            | MigrateMeteoraDammLockLpTokenForCreatorParam
            | MigrateMeteoraDammLockLpTokenForPartnerParam,
        isCreator: boolean
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const eventAuthority = deriveEventAuthority(program.programId)
        const accounts = {
            ...lockLpTokenParam,
            eventAuthority,
            program: program.programId,
        }

        if (isCreator) {
            return program.methods
                .migrateMeteoraDammLockLpTokenForCreator()
                .accounts(accounts)
                .transaction()
        } else {
            return program.methods
                .migrateMeteoraDammLockLpTokenForPartner()
                .accounts(accounts)
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
