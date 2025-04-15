import { test, expect, mock } from 'bun:test'
import { MigrationService, VirtualCurveProgramClient } from '../../src/client'
import { Keypair, Transaction } from '@solana/web3.js'
import { mockProgramClient, mockConnection } from '../utils/mock-client'

test('createDammMigrationMetadata - DAMM V1', async () => {
    // Setup
    const migrationService = new MigrationService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const config = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await migrationService.createDammMigrationMetadata({
        virtualPool,
        config,
        payer,
        migrateToDammV2: false,
    })

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(
        mockProgramClient.getProgram().methods
            .migrationMeteoraDammCreateMetadata
    ).toHaveBeenCalled()
})

test('createDammMigrationMetadata - DAMM V2', async () => {
    // Setup
    const migrationService = new MigrationService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const config = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await migrationService.createDammMigrationMetadata({
        virtualPool,
        config,
        payer,
        migrateToDammV2: true,
    })

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(
        mockProgramClient.getProgram().methods.migrationDammV2CreateMetadata
    ).toHaveBeenCalled()
})

test('migrateToDammV1', async () => {
    // Setup
    const migrationService = new MigrationService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const dammConfig = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await migrationService.migrateToDammV1(
        mockConnection,
        virtualPool,
        {
            virtualPool,
            dammConfig,
            payer,
        }
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(
        mockConnection,
        virtualPool
    )
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(
        mockProgramClient.getProgram().methods.migrateMeteoraDamm
    ).toHaveBeenCalled()
})

test('migrateToDammV2', async () => {
    // Setup
    const migrationService = new MigrationService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const dammConfig = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await migrationService.migrateToDammV2(
        mockConnection,
        virtualPool,
        {
            virtualPool,
            dammConfig,
            payer,
        }
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(
        mockConnection,
        virtualPool
    )
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(
        mockProgramClient.getProgram().methods.migrationDammV2
    ).toHaveBeenCalled()
})

test('getDammV1MigrationMetadata', async () => {
    // Setup
    const migrationService = new MigrationService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const metadataAddress = Keypair.generate().publicKey

    // Execute
    const metadata =
        await migrationService.getDammV1MigrationMetadata(metadataAddress)

    // Verify
    expect(metadata).toBeDefined()
    // We can't check specific values since we're using random keys now
    expect(metadata.virtualPool).toBeDefined()
    expect(metadata.poolCreator).toBeDefined()
    expect(metadata.partner).toBeDefined()
    expect(metadata.creatorLp.toString()).toBe('400000')
    expect(metadata.partnerLp.toString()).toBe('200000')
})

test('lockDammV1LpToken - for partner', async () => {
    // Setup
    const migrationService = new MigrationService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const dammConfig = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await migrationService.lockDammV1LpToken(
        mockConnection,
        virtualPool,
        {
            virtualPool,
            dammConfig,
            payer,
            isPartner: true,
        }
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(
        mockConnection,
        virtualPool
    )
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(
        mockProgramClient.getProgram().methods
            .migrateMeteoraDammLockLpTokenForPartner
    ).toHaveBeenCalled()
})

test('lockDammV1LpToken - for creator', async () => {
    // Setup
    const migrationService = new MigrationService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const dammConfig = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await migrationService.lockDammV1LpToken(
        mockConnection,
        virtualPool,
        {
            virtualPool,
            dammConfig,
            payer,
            isPartner: false,
        }
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(
        mockConnection,
        virtualPool
    )
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(
        mockProgramClient.getProgram().methods
            .migrateMeteoraDammLockLpTokenForCreator
    ).toHaveBeenCalled()
})

test('claimDammV1LpToken - for partner', async () => {
    // Setup
    const migrationService = new MigrationService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const dammConfig = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await migrationService.claimDammV1LpToken(
        mockConnection,
        virtualPool,
        {
            virtualPool,
            dammConfig,
            payer,
            isPartner: true,
        }
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(
        mockConnection,
        virtualPool
    )
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(
        mockProgramClient.getProgram().methods
            .migrateMeteoraDammPartnerClaimLpToken
    ).toHaveBeenCalled()
})

test('claimDammV1LpToken - for creator', async () => {
    // Setup
    const migrationService = new MigrationService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const dammConfig = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await migrationService.claimDammV1LpToken(
        mockConnection,
        virtualPool,
        {
            virtualPool,
            dammConfig,
            payer,
            isPartner: false,
        }
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(
        mockConnection,
        virtualPool
    )
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(
        mockProgramClient.getProgram().methods
            .migrateMeteoraDammCreatorClaimLpToken
    ).toHaveBeenCalled()
})

test('error handling - pool not found', async () => {
    // Setup
    const errorMockProgramClient = {
        ...mockProgramClient,
        getPool: mock(async () => null),
    }

    const migrationService = new MigrationService(
        errorMockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const dammConfig = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute & Verify
    await expect(
        migrationService.migrateToDammV1(mockConnection, virtualPool, {
            virtualPool,
            dammConfig,
            payer,
        })
    ).rejects.toThrow(`Pool not found: ${virtualPool.toString()}`)
})
