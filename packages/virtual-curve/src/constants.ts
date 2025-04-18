import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'
import {
    ActivationType,
    CollectFeeMode,
    FeeSchedulerMode,
    MigrationFeeOption,
    MigrationOption,
    TokenDecimal,
    TokenType,
} from './types'

export const BASIS_POINT_MAX: number = 10_000
export const OFFSET: number = 64
export const U64_MAX: BN = new BN('18446744073709551615')
export const MIN_SQRT_PRICE: BN = new BN('4295048016')
export const MAX_SQRT_PRICE: BN = new BN('79226673521066979257578248091')

// Curve constants
export const MAX_CURVE_POINT = 20
export const FEE_DENOMINATOR = new BN(1_000_000_000)
export const MAX_FEE_NUMERATOR = new BN(500_000_000)
export const MAX_TOKEN_SUPPLY = new BN(10_000_000_000)
export const SCALE_OFFSET = 64
export const ONE = new BN(1).shln(SCALE_OFFSET)
export const RESOLUTION = 64
export const ONE_Q64 = new BN(1).shln(RESOLUTION)
export const PARTNER_SURPLUS_SHARE = 90

// Pubkey
export const VIRTUAL_CURVE_PROGRAM_ID = new PublicKey(
    'virEFLZsQm1iFAs8py1XnziJ67gTzW2bfCWhxNPfccD'
)
export const METAPLEX_PROGRAM_ID = new PublicKey(
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
)
export const DAMM_V1_PROGRAM_ID = new PublicKey(
    'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'
)
export const DAMM_V2_PROGRAM_ID = new PublicKey(
    'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG'
)
export const VAULT_PROGRAM_ID = new PublicKey(
    '24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi'
)
export const LOCKER_PROGRAM_ID = new PublicKey(
    'LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn'
)
export const BASE_ADDRESS = new PublicKey(
    'HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv'
)

// PumpFun Config
export const PUMP_FUN_CONFIG = {
    poolFees: {
        baseFee: {
            cliffFeeNumerator: new BN(10_000_000),
            numberOfPeriod: 0,
            periodFrequency: new BN(0),
            reductionFactor: new BN(0),
            feeSchedulerMode: FeeSchedulerMode.Linear,
        },
        dynamicFee: {
            binStep: 1,
            binStepU128: new BN('1844674407370955'),
            filterPeriod: 10,
            decayPeriod: 120,
            reductionFactor: 5000,
            variableFeeControl: 2000000,
            maxVolatilityAccumulator: 100000,
        },
    },
    collectFeeMode: CollectFeeMode.OnlyQuote,
    migrationOption: MigrationOption.MET_DAMM,
    activationType: ActivationType.Slot,
    tokenType: TokenType.SPL,
    tokenDecimal: TokenDecimal.NINE,
    partnerLpPercentage: 50,
    partnerLockedLpPercentage: 0,
    creatorLpPercentage: 50,
    creatorLockedLpPercentage: 0,
    migrationQuoteThreshold: new BN(80_000_000_000),
    sqrtStartPrice: new BN('8590096032'),
    lockedVesting: {
        amountPerPeriod: new BN(0),
        cliffDurationFromMigrationTime: new BN(0),
        frequency: new BN(0),
        numberOfPeriod: new BN(0),
        cliffUnlockAmount: new BN(0),
    },
    migrationFeeOption: MigrationFeeOption.FixedBps25,
    padding: [0, 0, 0, 0, 0, 0, 0],
    curve: [
        {
            sqrtPrice: new BN('79226673521066979257578248091'),
            liquidity: new BN('7777830224951353470732300743229390000'),
        },
    ],
}
