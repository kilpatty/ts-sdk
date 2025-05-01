import { Commitment, Connection } from '@solana/web3.js'
import { PoolService } from './services/pool'
import { MigrationService } from './services/migration'
import { PartnerService } from './services/partner'
import { CreatorService } from './services/creator'
import { StateService } from './services/state'

export class DynamicBondingCurveClient {
    public pool: PoolService
    public partner: PartnerService
    public creator: CreatorService
    public migration: MigrationService
    public state: StateService
    public commitment: Commitment
    public connection: Connection

    constructor(connection: Connection, commitment: Commitment) {
        this.pool = new PoolService(connection, commitment)
        this.partner = new PartnerService(connection, commitment)
        this.creator = new CreatorService(connection, commitment)
        this.migration = new MigrationService(connection, commitment)
        this.state = new StateService(connection, commitment)
        this.commitment = commitment
        this.connection = connection
    }

    /**
     * Static method to create a client instance for a specific pool
     * @param connection - The connection to the Solana network
     * @returns A DynamicBondingCurveClient instance
     */
    static create(
        connection: Connection,
        commitment: Commitment = 'confirmed'
    ): DynamicBondingCurveClient {
        return new DynamicBondingCurveClient(connection, commitment)
    }
}
