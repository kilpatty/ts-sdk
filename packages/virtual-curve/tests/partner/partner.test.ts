import { test, expect, mock } from 'bun:test'
import { PartnerService, VirtualCurveProgramClient } from '../../src/client'
import { Keypair, Transaction } from '@solana/web3.js'
import BN from 'bn.js'
import { mockProgramClient, mockConnection } from '../utils/mock-client'

test('createConfig', async () => {
    // Setup
    const partnerService = new PartnerService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const config = Keypair.generate().publicKey
    const feeClaimer = Keypair.generate().publicKey
    const owner = Keypair.generate().publicKey
    const quoteMint = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await partnerService.createConfig({
        config,
        feeClaimer,
        owner,
        quoteMint,
        payer,
        migrationQuoteThreshold: new BN(1000),
        collectFeeMode: 0,
        curve: [],
        activationType: 0,
        partnerLockedLpPercentage: 10,
        partnerLpPercentage: 20,
        creatorLockedLpPercentage: 15,
        creatorLpPercentage: 25,
        poolFees: {
            baseFee: {
                cliffFeeNumerator: new BN(30),
                periodFrequency: new BN(0),
                reductionFactor: new BN(0),
                numberOfPeriod: 0,
                feeSchedulerMode: 0,
            },
            dynamicFee: {
                binStep: 0,
                binStepU128: new BN(0),
                filterPeriod: 0,
                decayPeriod: 0,
                reductionFactor: 0,
                maxVolatilityAccumulator: 0,
                variableFeeControl: 0,
            },
        },
        migrationOption: 0,
        tokenDecimal: 6,
        tokenType: 0,
        sqrtStartPrice: new BN(0),
        padding: [],
    })

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(
        mockProgramClient.getProgram().methods.createConfig
    ).toHaveBeenCalled()
})

test('createPartnerMetadata', async () => {
    // Setup
    const partnerService = new PartnerService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const feeClaimer = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute
    const transaction = await partnerService.createPartnerMetadata({
        feeClaimer,
        payer,
        name: 'Test Partner',
        website: 'https://example.com',
        logo: 'https://example.com/logo.png',
    })

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(
        mockProgramClient.getProgram().methods.createPartnerMetadata
    ).toHaveBeenCalled()
})

test('partnerWithdrawSurplus', async () => {
    // Setup
    const partnerService = new PartnerService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const feeClaimer = Keypair.generate().publicKey

    // Execute
    const transaction = await partnerService.partnerWithdrawSurplus(
        virtualPool,
        {
            virtualPool,
            feeClaimer,
        },
        mockConnection
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(
        mockConnection,
        virtualPool
    )
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(
        mockProgramClient.getProgram().methods.partnerWithdrawSurplus
    ).toHaveBeenCalled()
})

test('error handling - pool not found', async () => {
    // Setup
    const errorMockProgramClient = {
        ...mockProgramClient,
        getPool: mock(async () => null),
    }

    const partnerService = new PartnerService(
        errorMockProgramClient as unknown as VirtualCurveProgramClient
    )
    const virtualPool = Keypair.generate().publicKey
    const feeClaimer = Keypair.generate().publicKey

    // Execute & Verify
    await expect(
        partnerService.partnerWithdrawSurplus(
            virtualPool,
            {
                virtualPool,
                feeClaimer,
            },
            mockConnection
        )
    ).rejects.toThrow(`Pool not found: ${virtualPool.toString()}`)
})

test('createConfig with minimal parameters', async () => {
    // Setup
    const partnerService = new PartnerService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const config = Keypair.generate().publicKey
    const feeClaimer = Keypair.generate().publicKey
    const owner = Keypair.generate().publicKey
    const quoteMint = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute - with minimal required parameters
    const transaction = await partnerService.createConfig({
        config,
        feeClaimer,
        owner,
        quoteMint,
        payer,
        poolFees: {
            baseFee: {
                cliffFeeNumerator: new BN(30),
                periodFrequency: new BN(0),
                reductionFactor: new BN(0),
                numberOfPeriod: 0,
                feeSchedulerMode: 0,
            },
            dynamicFee: {
                binStep: 0,
                binStepU128: new BN(0),
                filterPeriod: 0,
                decayPeriod: 0,
                reductionFactor: 0,
                maxVolatilityAccumulator: 0,
                variableFeeControl: 0,
            },
        },
        collectFeeMode: 0,
        migrationOption: 0,
        activationType: 0,
        tokenType: 0,
        tokenDecimal: 6,
        partnerLpPercentage: 0,
        partnerLockedLpPercentage: 50,
        creatorLpPercentage: 0,
        creatorLockedLpPercentage: 50,
        migrationQuoteThreshold: new BN(1_000_000_000),
        sqrtStartPrice: new BN('97539491880527374'),
        curve: [
            {
                sqrtPrice: new BN('79226673521066979257578248091'),
                liquidity: new BN('103301766812773489049600000000000'),
            },
        ],
        padding: [],
    })

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(
        mockProgramClient.getProgram().methods.createConfig
    ).toHaveBeenCalled()
})

test('createPartnerMetadata with minimal parameters', async () => {
    // Setup
    const partnerService = new PartnerService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const feeClaimer = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey

    // Execute - with minimal required parameters
    const transaction = await partnerService.createPartnerMetadata({
        feeClaimer,
        payer,
        name: 'Test Partner',
        website: '', // Empty but required
        logo: '', // Empty but required
    })

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(
        mockProgramClient.getProgram().methods.createPartnerMetadata
    ).toHaveBeenCalled()
})
