import {
    Commitment,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    type Connection,
} from '@solana/web3.js'
import {
    ClaimCreatorTradingFeeParam,
    CreateVirtualPoolMetadataParam,
    CreateVirtualPoolMetadataParameters,
    CreatorWithdrawSurplusParam,
    TokenType,
} from '../types'
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
import { DynamicBondingCurveProgram } from './program'
import { deriveDbcPoolMetadata } from '../helpers'
import { StateService } from './state'

export class CreatorService extends DynamicBondingCurveProgram {
    private state: StateService

    constructor(connection: Connection, commitment: Commitment) {
        super(connection, commitment)
        this.state = new StateService(connection, commitment)
    }

    /**
     * Create virtual pool metadata
     * @param createVirtualPoolMetadataParam - The parameters for the virtual pool metadata
     * @returns A create virtual pool metadata transaction
     */
    async createPoolMetadata(
        createVirtualPoolMetadataParam: CreateVirtualPoolMetadataParam
    ): Promise<Transaction> {
        const virtualPoolMetadata = deriveDbcPoolMetadata(
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

        return this.program.methods
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
        const { creator, pool, maxBaseAmount, maxQuoteAmount } =
            claimCreatorTradingFeeParam

        const poolState = await this.state.getPool(pool)

        if (!poolState) {
            throw new Error(`Pool not found: ${pool.toString()}`)
        }

        const poolConfigState = await this.state.getPoolConfig(poolState.config)

        if (!poolConfigState) {
            throw new Error(`Pool config not found: ${pool.toString()}`)
        }

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
            poolState.baseMint,
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
                poolState.baseMint,
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
            poolAuthority: this.poolAuthority,
            pool,
            tokenAAccount: baseTokenAccount,
            tokenBAccount: quoteTokenAccount,
            baseVault: poolState.baseVault,
            quoteVault: poolState.quoteVault,
            baseMint: poolState.baseMint,
            quoteMint: poolConfigState.quoteMint,
            creator,
            tokenBaseProgram,
            tokenQuoteProgram,
        }

        return this.program.methods
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
        const { creator, virtualPool } = creatorWithdrawSurplusParam

        const poolState = await this.state.getPool(virtualPool)

        if (!poolState) {
            throw new Error(`Pool not found: ${virtualPool.toString()}`)
        }

        const poolConfigState = await this.state.getPoolConfig(poolState.config)

        if (!poolConfigState) {
            throw new Error(`Pool config not found: ${virtualPool.toString()}`)
        }

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
            poolAuthority: this.poolAuthority,
            config: poolState.config,
            virtualPool,
            tokenQuoteAccount,
            quoteVault: poolState.quoteVault,
            quoteMint: poolConfigState.quoteMint,
            creator,
            tokenQuoteProgram: TOKEN_PROGRAM_ID,
        }

        return this.program.methods
            .creatorWithdrawSurplus()
            .accountsPartial(accounts)
            .preInstructions(preInstructions)
            .postInstructions(postInstructions)
            .transaction()
    }
}
