import type {
    CloseClaimFeeOperatorParam,
    CreateClaimFeeOperatorParam,
    VirtualCurveAdminInterface,
} from './types'
import type { Connection } from '@solana/web3.js'
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
     * Create a claim fee operator
     * @param connection - The connection to the Solana network
     * @param createClaimFeeOperatorParam - The parameters for the claim fee operator
     * @returns A transaction
     */
    static async createClaimFeeOperator(
        connection: Connection,
        createClaimFeeOperatorParam: CreateClaimFeeOperatorParam
    ) {
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
     * Close a claim fee operator
     * @param connection - The connection to the Solana network
     * @param params - The parameters for the claim fee operator
     * @returns A transaction
     */
    static async closeClaimFeeOperator(
        connection: Connection,
        params: CloseClaimFeeOperatorParam
    ) {
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
}
