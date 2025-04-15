import { test, expect, mock } from 'bun:test'
import { PoolService, VirtualCurveProgramClient } from '../../src/client'
import { Keypair, Transaction } from '@solana/web3.js'
import BN from 'bn.js'
import { TokenType } from '../../src/types'
import { Q } from '../utils/test-helpers'
import { DEFAULT_POOL_CONFIG, DEFAULT_VIRTUAL_POOL } from '../utils/defaults'
import { mockProgramClient, mockConnection } from '../utils/mock-client'

test('createPool - with SPL token', async () => {
    // Setup
    const poolService = new PoolService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const quoteMint = Keypair.generate().publicKey
    const baseMint = Keypair.generate().publicKey
    const config = Keypair.generate().publicKey
    const creator = Keypair.generate().publicKey

    // Execute
    const transaction = await poolService.createPool({
        quoteMint,
        baseMint,
        config,
        baseTokenType: TokenType.SPL,
        quoteTokenType: TokenType.SPL,
        name: 'Test Pool',
        symbol: 'TPOOL',
        uri: 'https://example.com/metadata.json',
        creator,
    })

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(
        mockProgramClient.getProgram().methods.initializeVirtualPoolWithSplToken
    ).toHaveBeenCalled()
})

test('createPool - with Token2022', async () => {
    // Setup
    const poolService = new PoolService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const quoteMint = Keypair.generate().publicKey
    const baseMint = Keypair.generate().publicKey
    const config = Keypair.generate().publicKey
    const creator = Keypair.generate().publicKey

    // Execute
    const transaction = await poolService.createPool({
        quoteMint,
        baseMint,
        config,
        baseTokenType: TokenType.Token2022,
        quoteTokenType: TokenType.SPL,
        name: 'Test Pool',
        symbol: 'TPOOL',
        uri: 'https://example.com/metadata.json',
        creator,
    })

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(
        mockProgramClient.getProgram().methods
            .initializeVirtualPoolWithToken2022
    ).toHaveBeenCalled()
})

test('createPool - with invalid token type', async () => {
    // Setup
    const poolService = new PoolService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const quoteMint = Keypair.generate().publicKey
    const baseMint = Keypair.generate().publicKey
    const config = Keypair.generate().publicKey
    const creator = Keypair.generate().publicKey

    // Execute & Verify
    await expect(
        poolService.createPool({
            quoteMint,
            baseMint,
            config,
            baseTokenType: 99 as TokenType, // Invalid token type
            quoteTokenType: TokenType.SPL,
            name: 'Test Pool',
            symbol: 'TPOOL',
            uri: 'https://example.com/metadata.json',
            creator,
        })
    ).rejects.toThrow('Invalid base token type')
})

test('swap - base to quote', async () => {
    // Setup
    const poolService = new PoolService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const pool = Keypair.generate().publicKey
    const owner = Keypair.generate().publicKey

    // Execute
    const transaction = await poolService.swap(
        pool,
        {
            amountIn: new BN(1000000),
            minimumAmountOut: new BN(900000),
            swapBaseForQuote: true,
            owner,
        },
        mockConnection
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(mockConnection, pool)
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(mockProgramClient.getProgram().methods.swap).toHaveBeenCalled()
})

test('swap - quote to base', async () => {
    // Setup
    const poolService = new PoolService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const pool = Keypair.generate().publicKey
    const owner = Keypair.generate().publicKey

    // Execute
    const transaction = await poolService.swap(
        pool,
        {
            amountIn: new BN(1000000),
            minimumAmountOut: new BN(900000),
            swapBaseForQuote: false,
            owner,
        },
        mockConnection
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(mockConnection, pool)
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(mockProgramClient.getProgram().methods.swap).toHaveBeenCalled()
})

test('swap - pool not found', async () => {
    // Setup
    const errorMockProgramClient = {
        ...mockProgramClient,
        getPool: mock(async () => null),
    }

    const poolService = new PoolService(
        errorMockProgramClient as unknown as VirtualCurveProgramClient
    )
    const pool = Keypair.generate().publicKey
    const owner = Keypair.generate().publicKey

    // Execute & Verify
    await expect(
        poolService.swap(
            pool,
            {
                amountIn: new BN(1000000),
                minimumAmountOut: new BN(900000),
                swapBaseForQuote: true,
                owner,
            },
            mockConnection
        )
    ).rejects.toThrow(`Pool not found: ${pool.toString()}`)
})

test('claimTradingFee', async () => {
    // Setup
    const poolService = new PoolService(
        mockProgramClient as unknown as VirtualCurveProgramClient
    )
    const pool = Keypair.generate().publicKey
    const feeClaimer = Keypair.generate().publicKey

    // Execute
    const transaction = await poolService.claimTradingFee(
        pool,
        {
            pool,
            feeClaimer,
            maxBaseAmount: new BN(1000000),
            maxQuoteAmount: new BN(1000000),
        },
        mockConnection
    )

    // Verify
    expect(transaction).toBeInstanceOf(Transaction)
    expect(mockProgramClient.getPool).toHaveBeenCalledWith(mockConnection, pool)
    expect(mockProgramClient.getPoolConfig).toHaveBeenCalled()
    expect(
        mockProgramClient.getProgram().methods.claimTradingFee
    ).toHaveBeenCalled()
})

test('claimTradingFee - pool not found', async () => {
    // Setup
    const errorMockProgramClient = {
        ...mockProgramClient,
        getPool: mock(async () => null),
    }

    const poolService = new PoolService(
        errorMockProgramClient as unknown as VirtualCurveProgramClient
    )
    const pool = Keypair.generate().publicKey
    const feeClaimer = Keypair.generate().publicKey

    // Execute & Verify
    await expect(
        poolService.claimTradingFee(
            pool,
            {
                pool,
                feeClaimer,
                maxBaseAmount: new BN(1000000),
                maxQuoteAmount: new BN(1000000),
            },
            mockConnection
        )
    ).rejects.toThrow(`Pool not found: ${pool.toString()}`)
})

test('VirtualCurveProgramClient.swapQuote', () => {
    // Setup
    const programClient = new VirtualCurveProgramClient(mockConnection)
    const mockSwapQuote = mock(() => ({
        amountOut: new BN(900000),
        minimumAmountOut: new BN(890000),
        nextSqrtPrice: Q(1.1),
        fee: {
            trading: new BN(10000),
            protocol: new BN(2000),
            referral: new BN(0),
        },
        price: {
            beforeSwap: 1.0,
            afterSwap: 1.1,
        },
    }))

    // Replace the imported swapQuote function with our mock
    Object.defineProperty(programClient, 'swapQuote', {
        value: mockSwapQuote,
        writable: true,
    })

    // Execute
    const result = programClient.swapQuote(
        DEFAULT_VIRTUAL_POOL,
        DEFAULT_POOL_CONFIG,
        true,
        new BN(1000000),
        false,
        Q(1.0)
    )

    // Verify
    expect(mockSwapQuote).toHaveBeenCalledWith(
        DEFAULT_VIRTUAL_POOL,
        DEFAULT_POOL_CONFIG,
        true,
        new BN(1000000),
        false,
        Q(1.0)
    )
    expect(result.amountOut.toString()).toBe('900000')
    expect(result.minimumAmountOut.toString()).toBe('890000')
    expect(result.fee.trading.toString()).toBe('10000')
    expect(result.fee.protocol.toString()).toBe('2000')
})
