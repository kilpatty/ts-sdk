import {
    SystemProgram,
    Transaction,
    TransactionInstruction,
    type Connection,
} from '@solana/web3.js'
import type { DynamicBondingCurveClient } from '../client'
import {
    ClaimCreatorTradingFeeParam,
    CreateVirtualPoolMetadataParam,
    CreateVirtualPoolMetadataParameters,
    CreatorWithdrawSurplusParam,
    TokenType,
} from '../types'
import { derivePoolAuthority, deriveVirtualPoolMetadata } from '../derive'
import { DYNAMIC_BONDING_CURVE_PROGRAM_ID } from '../constants'
import {
    createAssociatedTokenAccountIdempotentInstruction,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
    findAssociatedTokenAddress,
    isNativeSol,
    unwrapSOLInstruction,
} from '../utils'

export class CreatorService {
    private connection: Connection

    constructor(private programClient: DynamicBondingCurveClient) {
        this.connection = this.programClient.getProgram().provider.connection
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
        }

        return program.methods
            .createVirtualPoolMetadata(virtualPoolMetadataParam)
            .accountsPartial(accounts)
            .transaction()
    }

    /**
     * Claim creator trading fee
     * @param claimCreatorTradingFeeParam - The parameters for the claim creator trading fee
     * @returns A claim creator trading fee transaction
     */
    async claimCreatorTradingFee(
        claimCreatorTradingFeeParam: ClaimCreatorTradingFeeParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const { creator, pool, maxBaseAmount, maxQuoteAmount } =
            claimCreatorTradingFeeParam

        const virtualPoolState = await this.programClient.getPool(pool)

        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${pool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        if (!poolConfigState) {
            throw new Error(`Pool config not found: ${pool.toString()}`)
        }

        const poolAuthority = derivePoolAuthority(
            DYNAMIC_BONDING_CURVE_PROGRAM_ID
        )

        const tokenBaseProgram =
            poolConfigState.tokenType == TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const tokenQuoteProgram =
            poolConfigState.quoteTokenFlag == TokenType.SPL
                ? TOKEN_PROGRAM_ID
                : TOKEN_2022_PROGRAM_ID

        const preInstructions: TransactionInstruction[] = []
        const postInstructions: TransactionInstruction[] = []

        const baseTokenAccount = findAssociatedTokenAddress(
            creator,
            virtualPoolState.baseMint,
            tokenBaseProgram
        )

        const quoteTokenAccount = findAssociatedTokenAddress(
            creator,
            poolConfigState.quoteMint,
            tokenQuoteProgram
        )

        const createBaseTokenAccountIx =
            createAssociatedTokenAccountIdempotentInstruction(
                creator,
                baseTokenAccount,
                creator,
                virtualPoolState.baseMint,
                tokenBaseProgram
            )

        if (createBaseTokenAccountIx) {
            preInstructions.push(createBaseTokenAccountIx)
        }

        const createQuoteTokenAccountIx =
            createAssociatedTokenAccountIdempotentInstruction(
                creator,
                quoteTokenAccount,
                creator,
                poolConfigState.quoteMint,
                tokenQuoteProgram
            )

        if (createQuoteTokenAccountIx) {
            preInstructions.push(createQuoteTokenAccountIx)
        }

        const isSOLQuoteMint = isNativeSol(poolConfigState.quoteMint)

        if (isSOLQuoteMint) {
            const unwrapIx = unwrapSOLInstruction(creator)
            if (unwrapIx) {
                postInstructions.push(unwrapIx)
            }
        }

        const accounts = {
            poolAuthority,
            pool,
            tokenAAccount: baseTokenAccount,
            tokenBAccount: quoteTokenAccount,
            baseVault: virtualPoolState.baseVault,
            quoteVault: virtualPoolState.quoteVault,
            baseMint: virtualPoolState.baseMint,
            quoteMint: poolConfigState.quoteMint,
            creator,
            tokenBaseProgram,
            tokenQuoteProgram,
        }

        return program.methods
            .claimCreatorTradingFee(maxBaseAmount, maxQuoteAmount)
            .accountsPartial(accounts)
            .preInstructions(preInstructions)
            .postInstructions(postInstructions)
            .transaction()
    }

    /**
     * Withdraw creator surplus
     * @param creatorWithdrawSurplusParam - The parameters for the creator withdraw surplus
     * @returns A creator withdraw surplus transaction
     */
    async creatorWithdrawSurplus(
        creatorWithdrawSurplusParam: CreatorWithdrawSurplusParam
    ): Promise<Transaction> {
        const program = this.programClient.getProgram()
        const { creator, virtualPool } = creatorWithdrawSurplusParam

        const virtualPoolState = await this.programClient.getPool(virtualPool)

        if (!virtualPoolState) {
            throw new Error(`Pool not found: ${virtualPool.toString()}`)
        }

        const poolConfigState = await this.programClient.getPoolConfig(
            virtualPoolState.config
        )

        if (!poolConfigState) {
            throw new Error(`Pool config not found: ${virtualPool.toString()}`)
        }

        const poolAuthority = derivePoolAuthority(
            DYNAMIC_BONDING_CURVE_PROGRAM_ID
        )

        const preInstructions: TransactionInstruction[] = []
        const postInstructions: TransactionInstruction[] = []

        const tokenQuoteAccount = findAssociatedTokenAddress(
            creator,
            poolConfigState.quoteMint,
            TOKEN_PROGRAM_ID
        )

        const createQuoteTokenAccountIx =
            createAssociatedTokenAccountIdempotentInstruction(
                creator,
                tokenQuoteAccount,
                creator,
                poolConfigState.quoteMint,
                TOKEN_PROGRAM_ID
            )

        if (createQuoteTokenAccountIx) {
            preInstructions.push(createQuoteTokenAccountIx)
        }

        const isSOLQuoteMint = isNativeSol(poolConfigState.quoteMint)

        if (isSOLQuoteMint) {
            const unwrapIx = unwrapSOLInstruction(creator)
            if (unwrapIx) {
                postInstructions.push(unwrapIx)
            }
        }

        const accounts = {
            poolAuthority,
            config: virtualPoolState.config,
            virtualPool,
            tokenQuoteAccount,
            quoteVault: virtualPoolState.quoteVault,
            quoteMint: poolConfigState.quoteMint,
            creator,
            tokenQuoteProgram: TOKEN_PROGRAM_ID,
        }

        return program.methods
            .creatorWithdrawSurplus()
            .accountsPartial(accounts)
            .preInstructions(preInstructions)
            .postInstructions(postInstructions)
            .transaction()
    }
}
