import {
    TokenType,
    type CreateConfigParam,
    type CreatePoolParam,
    type InitializeVirtualPoolWithSplTokenAccounts,
    type InitializeVirtualPoolWithToken2022Accounts,
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

    async swap(swapParam: SwapParam) {
        const { amountIn, minAmountOut, swapBaseForQuote, owner } = swapParam

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
                    amountIn.toNumber()
                )
            )
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

        return this.program.methods
            .swap({
                amountIn,
                minAmountOut,
                swapBaseForQuote,
            })
            .accounts(accounts)
            .transaction()
    }
}
