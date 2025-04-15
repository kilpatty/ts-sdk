import { Connection, Keypair, Transaction } from '@solana/web3.js'
import BN from 'bn.js'
import { mock } from 'bun:test'
import { Q } from './test-helpers'
import { DEFAULT_POOL_CONFIG, DEFAULT_VIRTUAL_POOL } from './defaults'
import { TokenType } from '../../src/types'

// Mock transaction that can be returned by all methods
const mockTransaction = new Transaction()

// Mock the vault and DAMM V1 programs
const mockVaultProgram = {
    methods: {
        initialize: mock(() => ({
            accountsStrict: mock(() => ({
                instruction: mock(() => ({})),
            })),
        })),
    },
    programId: Keypair.generate().publicKey,
}

const mockDammV1Program = {
    methods: {
        createLockEscrow: mock(() => ({
            accountsStrict: mock(() => ({
                instruction: mock(() => ({})),
            })),
        })),
    },
    programId: Keypair.generate().publicKey,
}

// Create mock methods for the program
const mockMethods = {
    // Partner methods
    createConfig: mock(() => ({
        accounts: mock(() => ({
            transaction: mock(() => mockTransaction),
        })),
    })),
    createPartnerMetadata: mock(() => ({
        accounts: mock(() => ({
            transaction: mock(() => mockTransaction),
        })),
    })),
    partnerWithdrawSurplus: mock(() => ({
        accounts: mock(() => ({
            transaction: mock(() => mockTransaction),
        })),
    })),

    // Pool methods
    initializeVirtualPoolWithSplToken: mock(() => ({
        accounts: mock(() => ({
            transaction: mock(() => mockTransaction),
        })),
    })),
    initializeVirtualPoolWithToken2022: mock(() => ({
        accounts: mock(() => ({
            transaction: mock(() => mockTransaction),
        })),
    })),
    swap: mock(() => ({
        accounts: mock(() => ({
            transaction: mock(() => mockTransaction),
        })),
    })),
    claimTradingFee: mock(() => ({
        accounts: mock(() => ({
            transaction: mock(() => mockTransaction),
        })),
    })),

    // Migration methods
    migrationMeteoraDammCreateMetadata: mock(() => ({
        accountsPartial: mock(() => ({
            transaction: mock(() => mockTransaction),
        })),
    })),
    migrationDammV2CreateMetadata: mock(() => ({
        accountsPartial: mock(() => ({
            transaction: mock(() => mockTransaction),
        })),
    })),
    migrateMeteoraDamm: mock(() => ({
        accountsStrict: mock(() => ({
            preInstructions: mock(() => ({
                transaction: mock(() => mockTransaction),
            })),
        })),
    })),
    migrationDammV2: mock(() => ({
        accountsStrict: mock(() => ({
            remainingAccounts: mock(() => ({
                transaction: mock(() => mockTransaction),
            })),
        })),
    })),
    migrateMeteoraDammLockLpTokenForPartner: mock(() => ({
        accountsStrict: mock(() => ({
            preInstructions: mock(() => ({
                transaction: mock(() => mockTransaction),
            })),
        })),
    })),
    migrateMeteoraDammLockLpTokenForCreator: mock(() => ({
        accountsStrict: mock(() => ({
            preInstructions: mock(() => ({
                transaction: mock(() => mockTransaction),
            })),
        })),
    })),
    migrateMeteoraDammPartnerClaimLpToken: mock(() => ({
        accounts: mock(() => ({
            preInstructions: mock(() => ({
                transaction: mock(() => mockTransaction),
            })),
        })),
    })),
    migrateMeteoraDammCreatorClaimLpToken: mock(() => ({
        accounts: mock(() => ({
            preInstructions: mock(() => ({
                transaction: mock(() => mockTransaction),
            })),
        })),
    })),
}

// Create a mock program
const mockProgram = {
    methods: mockMethods,
    account: {
        meteoraDammMigrationMetadata: {
            fetch: mock(async () => ({
                virtualPool: Keypair.generate().publicKey,
                poolCreator: Keypair.generate().publicKey,
                partner: Keypair.generate().publicKey,
                lpMint: Keypair.generate().publicKey,
                partnerLockedLp: new BN('300000'),
                partnerLp: new BN('200000'),
                creatorLockedLp: new BN('600000'),
                creatorLp: new BN('400000'),
                padding: [],
            })),
        },
    },
    programId: Keypair.generate().publicKey,
}

// Create a mock VirtualCurveProgramClient
export const mockProgramClient = {
    getPool: mock(async () => ({
        ...DEFAULT_VIRTUAL_POOL,
        baseMint: Keypair.generate().publicKey,
        baseVault: Keypair.generate().publicKey,
        quoteVault: Keypair.generate().publicKey,
        config: Keypair.generate().publicKey,
        creator: Keypair.generate().publicKey,
        baseReserve: new BN('1000000000000'),
        quoteReserve: new BN('1000000000000'),
        sqrtPrice: Q(1.0),
        poolType: TokenType.SPL,
    })),
    getPoolConfig: mock(async () => ({
        ...DEFAULT_POOL_CONFIG,
        quoteMint: Keypair.generate().publicKey,
        quoteTokenFlag: TokenType.SPL,
        tokenType: TokenType.SPL,
    })),
    getProgram: mock(() => mockProgram),
    createVaultProgram: mock(() => mockVaultProgram),
    createDammV1Program: mock(() => mockDammV1Program),
    swapQuote: mock(() => ({
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
    })),
}

// Create a mock connection
export const mockConnection = {
    getAccountInfo: mock(() => null),
} as unknown as Connection

// Export the mock methods for testing
export const methods = mockMethods
