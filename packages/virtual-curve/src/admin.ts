import type {
    ClaimProtocolFeeParam,
    CloseClaimFeeOperatorParam,
    CreateClaimFeeOperatorParam,
    ProtocolWithdrawSurplusParam,
    VirtualCurveAdminInterface,
} from './types'
import type { Connection, Transaction } from '@solana/web3.js'
import { VirtualCurve } from '.'
import { createProgram } from './utils'
import { deriveEventAuthority } from './derive'

export class VirtualCurveAdmin
    extends VirtualCurve
    implements VirtualCurveAdminInterface
{
    constructor(connection: Connection) {
        const { program } = createProgram(connection)
        super(program)
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
     * Close a claim fee operator
     * @param connection - The connection to the Solana network
     * @param params - The parameters for the claim fee operator
     * @returns A transaction
     */
    static async closeClaimFeeOperator(
        connection: Connection,
        params: CloseClaimFeeOperatorParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const eventAuthority = deriveEventAuthority(program.programId)
        const accounts = {
            ...params,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .closeClaimFeeOperator()
            .accounts(accounts)
            .transaction()
    }

    /**
     * Create a claim fee operator
     * @param connection - The connection to the Solana network
     * @param createClaimFeeOperatorParam - The parameters for the claim fee operator
     * @returns A transaction
     */
    static async createClaimFeeOperator(
        connection: Connection,
        createClaimFeeOperatorParam: CreateClaimFeeOperatorParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const eventAuthority = deriveEventAuthority(program.programId)
        const accounts = {
            ...createClaimFeeOperatorParam,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .createClaimFeeOperator()
            .accounts(accounts)
            .transaction()
    }

    /**
     * Protocol withdraw surplus
     * @param connection - The connection to the Solana network
     * @param params - The parameters for the protocol withdraw surplus
     * @returns A transaction
     */
    static async protocolWithdrawSurplus(
        connection: Connection,
        params: ProtocolWithdrawSurplusParam
    ): Promise<Transaction> {
        const { program } = createProgram(connection)
        const eventAuthority = deriveEventAuthority(program.programId)
        const accounts = {
            ...params,
            eventAuthority,
            program: program.programId,
        }

        return program.methods
            .protocolWithdrawSurplus()
            .accounts(accounts)
            .transaction()
    }
}
