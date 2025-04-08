import type {
    Accounts,
    Address,
    BN,
    IdlAccounts,
    IdlTypes,
    Program,
    ProgramAccount,
} from '@coral-xyz/anchor'
import type { VirtualCurve } from './idl/idl'
import type { Connection, PublicKey, Transaction } from '@solana/web3.js'

export type VirtualCurveProgram = Program<VirtualCurve>

// ix accounts
export type CreateClaimFeeOperatorAccounts = Accounts<
    VirtualCurve['instructions']['3']
>['createClaimFeeOperator']
export type CloseClaimFeeOperatorAccounts = Accounts<
    VirtualCurve['instructions']['2']
>['closeClaimFeeOperator']
export type ClaimProtocolFeeAccounts = Accounts<
    VirtualCurve['instructions']['0']
>['claimProtocolFee']
export type ClaimTradingFeeAccounts = Accounts<
    VirtualCurve['instructions']['1']
>['claimTradingFee']
export type CreateConfigAccounts = Accounts<
    VirtualCurve['instructions']['4']
>['createConfig']

// {
//   systemProgram: Address;
//   eventAuthority: Address;
//   program: Address;
//   config: Address;
//   pool: Address;
//   quoteMint: Address;
//   creator: Address;
//   baseMint: Address | undefined;
//   baseVault: Address;
//   quoteVault: Address;
//   payer: Address | undefined;
//   poolAuthority: Address;
//   mintMetadata: Address;
//   metadataProgram: Address;
//   tokenProgram: Address;
//   tokenQuoteProgram: Address;
// }
export type CreatorClaimLpFromMeteoraDynamicAmmAccounts = Accounts<
    VirtualCurve['instructions']['5']
>['creatorClaimLpFromMeteoraDynamicAmm']
export type InitializeVirtualPoolWithSplTokenAccounts = Accounts<
    VirtualCurve['instructions']['6']
>['initializeVirtualPoolWithSplToken']
export type InitializeVirtualPoolWithToken2022Accounts = Accounts<
    VirtualCurve['instructions']['7']
>['initializeVirtualPoolWithToken2022']
export type MigrateMeteoraDammAccounts = Accounts<
    VirtualCurve['instructions']['8']
>['migrateMeteoraDamm']
export type MigrateMeteoraDammCreatorClaimLpTokenAccounts = Accounts<
    VirtualCurve['instructions']['9']
>['migrateMeteoraDammCreatorClaimLpToken']
export type MigrateMeteoraDammLockLpTokenForCreatorAccounts = Accounts<
    VirtualCurve['instructions']['10']
>['migrateMeteoraDammLockLpTokenForCreator']
export type MigrateMeteoraDammLockLpTokenForPartnerAccounts = Accounts<
    VirtualCurve['instructions']['11']
>['migrateMeteoraDammLockLpTokenForPartner']
export type MigrateMeteoraDammPartnerClaimLpTokenAccounts = Accounts<
    VirtualCurve['instructions']['12']
>['migrateMeteoraDammPartnerClaimLpToken']
export type MigrationDammV2Accounts = Accounts<
    VirtualCurve['instructions']['13']
>['migrationDammV2']
export type MigrationDammV2CreateMetadataAccounts = Accounts<
    VirtualCurve['instructions']['14']
>['migrationDammV2CreateMetadata']

// {
//   config: Address;
//   poolAuthority: Address;
//   baseMint: Address;
//   quoteMint: Address;
//   pool: Address;
//   baseVault: Address;
//   quoteVault: Address;
//   payer: Address | undefined;
//   tokenQuoteProgram: Address;
//   eventAuthority: Address;
//   program: Address;
//   inputTokenAccount: Address;
//   outputTokenAccount: Address;
//   tokenBaseProgram: Address;
//   referralTokenAccount: Address | null;
// }
export type SwapAccounts = Accounts<VirtualCurve['instructions']['19']>['swap']

// types
export type InitializePoolParameters =
    IdlTypes<VirtualCurve>['initializePoolParameters']
export type SwapParameters = IdlTypes<VirtualCurve>['swapParameters']
export type ConfigParameters = IdlTypes<VirtualCurve>['configParameters']

// {
//   baseFee: {
//     cliffFeeNumerator: BN;
//     numberOfPeriod: number;
//     periodFrequency: BN;
//     reductionFactor: BN;
//     feeSchedulerMode: number;
// };
// dynamicFee: {
//     binStep: number;
//     binStepU128: BN;
//     filterPeriod: number;
//     decayPeriod: number;
//     reductionFactor: number;
//     maxVolatilityAccumulator: number;
//     variableFeeControl: number;
// } | null;
// }
export type PoolFeeParamters = IdlTypes<VirtualCurve>['poolFeeParamters']

// {
//     baseFee: {
//         cliffFeeNumerator: BN;
//         periodFrequency: BN;
//         reductionFactor: BN;
//         numberOfPeriod: number;
//         feeSchedulerMode: number;
//         padding0: number[];
//     };
export type BaseFeeParameters = IdlTypes<VirtualCurve>['baseFeeConfig']

// {
//   binStep: number;
//   binStepU128: BN;
//   filterPeriod: number;
//   decayPeriod: number;
//   reductionFactor: number;
//   maxVolatilityAccumulator: number;
//   variableFeeControl: number;
// }
export type DynamicFeeParameters =
    IdlTypes<VirtualCurve>['dynamicFeeParameters']

export type LiquidityDistributionParameters =
    IdlTypes<VirtualCurve>['liquidityDistributionParameters']

// {
//     baseFee: {
//         cliffFeeNumerator: BN;
//         periodFrequency: BN;
//         reductionFactor: BN;
//         numberOfPeriod: number;
//         feeSchedulerMode: number;
//         padding0: number[];
//     };
//     dynamicFee: {
//         initialized: number;
//         padding: number[];
//         maxVolatilityAccumulator: number;
//         variableFeeControl: number;
//         binStep: number;
//         filterPeriod: number;
//         decayPeriod: number;
//         reductionFactor: number;
//         padding2: number[];
//         binStepU128: BN;
//     };
//     padding0: BN[];
//     padding1: number[];
//     protocolFeePercent: number;
//     referralFeePercent: number;
// }
export type PoolFeesConfig = IdlTypes<VirtualCurve>['poolFeesConfig']

// {
//   initialized: number;
//   padding: number[];
//   maxVolatilityAccumulator: number;
//   variableFeeControl: number;
//   binStep: number;
//   filterPeriod: number;
//   decayPeriod: number;
//   reductionFactor: number;
//   padding2: number[];
//   binStepU128: BN;
// }
export type DynamicFeeConfig = IdlTypes<VirtualCurve>['dynamicFeeConfig']

export type LiquidityDistributionConfig =
    IdlTypes<VirtualCurve>['liquidityDistributionParameters']

//  {
//   tradeFeeNumerator: BN;
//   tradeFeeDenominator: BN;
//   protocolTradeFeeNumerator: BN;
//   protocolTradeFeeDenominator: BN;
// }
export type PoolFees = IdlTypes<VirtualCurve>['poolFees']
export type BaseFeeConfig = IdlTypes<VirtualCurve>['baseFeeConfig']
export type PoolMetrics = IdlTypes<VirtualCurve>['poolMetrics']
export type SwapResult = IdlTypes<VirtualCurve>['swapResult']

// accounts
export type ClaimFeeOperator = IdlAccounts<VirtualCurve>['claimFeeOperator']
export type Config = IdlAccounts<VirtualCurve>['config']

// {
//   quoteMint: PublicKey;
//   feeClaimer: PublicKey;
//   owner: PublicKey;
//   poolFees: {
//       baseFee: {
//           cliffFeeNumerator: BN;
//           periodFrequency: BN;
//           reductionFactor: BN;
//           numberOfPeriod: number;
//           feeSchedulerMode: number;
//           padding0: number[];
//       };
//       dynamicFee: {
//           initialized: number;
//           padding: number[];
//           maxVolatilityAccumulator: number;
//           variableFeeControl: number;
//           binStep: number;
//           filterPeriod: number;
//           decayPeriod: number;
//           reductionFactor: number;
//           padding2: number[];
//           binStepU128: BN;
//       };
//       padding0: BN[];
//       padding1: number[];
//       protocolFeePercent: number;
//       referralFeePercent: number;
//   };
//   collectFeeMode: number;
//   migrationOption: number;
//   activationType: number;
//   tokenDecimal: number;
//   tokenType: number;
//   creatorPostMigrationFeePercentage: number;
//   padding0: number[];
//   swapBaseAmount: BN;
//   migrationQuoteThreshold: BN;
//   migrationBaseThreshold: BN;
//   padding: BN[];
//   sqrtStartPrice: BN;
//   curve: {
//       sqrtPrice: BN;
//       liquidity: BN;
//   }[];
// }
export type PoolConfig = IdlAccounts<VirtualCurve>['poolConfig']

// {
//   virtualPool: PublicKey;
//   owner: PublicKey;
//   partner: PublicKey;
//   lpMint: PublicKey;
//   lpMintedAmountForCreator: BN;
//   lpMintedAmountForPartner: BN;
//   progress: number;
//   creatorLockedStatus: number;
//   partnerLockedStatus: number;
//   padding: number[];
// }
export type MeteoraDammMigrationMetadata =
    IdlAccounts<VirtualCurve>['meteoraDammMigrationMetadata']

// {
//     lastUpdateTimestamp: BN;
//     padding: number[];
//     sqrtPriceReference: BN;
//     volatilityAccumulator: BN;
//     volatilityReference: BN;
// }
export type VolatilityTracker = IdlTypes<VirtualCurve>['volatilityTracker']

export type VirtualPool = IdlAccounts<VirtualCurve>['virtualPool']

export enum SwapDirection {
    BaseToQuote,
    QuoteToBase,
}

export interface CurvePoint {
    sqrtPrice: BN
    liquidity: BN
}

export interface FeeResult {
    amount: BN
    protocolFee: BN
    tradingFee: BN
    referralFee: BN
}

export enum TradeDirection {
    BaseToQuote,
    QuoteToBase,
}

export interface FeeMode {
    feesOnInput: boolean
    feesOnBaseToken: boolean
    hasReferral: boolean
}

export type VirtualPoolState = IdlAccounts<VirtualCurve>['virtualPool']
export type PoolConfigState = IdlAccounts<VirtualCurve>['poolConfig']

export interface QuoteParams {
    amountIn: BN
    direction: SwapDirection
    slippage?: number // Optional slippage tolerance (e.g., 0.01 for 1%)
    pool: VirtualPoolState
}

export interface QuoteResult {
    amountOut: BN
    minimumAmountOut: BN
    nextSqrtPrice: BN
    fee: {
        trading: BN
        protocol: BN
        referral?: BN
    }
    price: {
        beforeSwap: number
        afterSwap: number
    }
}

export interface FeeMode {
    feesOnInput: boolean
    feesOnBaseToken: boolean
    hasReferral: boolean
}

export interface FeeOnAmountResult {
    amount: BN // Amount remaining after taking trading fee
    protocolFee: BN // Final protocol fee (after referral deduction)
    tradingFee: BN // Portion of trading fee NOT going to protocol
    referralFee: BN // Referral fee amount
}

export enum ActivationType {
    Slot = 0,
    Timestamp = 1,
}

export enum TokenType {
    SPL = 0,
    Token2022 = 1,
}

export enum CollectFeeMode {
    OnlyQuote = 0,
    Both = 1,
}

export enum MigrationOption {
    MET_DAMM = 0,
    MET_DAMM_V2 = 1,
}

export type CreateConfigParam = Omit<
    CreateConfigAccounts,
    'program' | 'eventAuthority' | 'systemProgram'
> &
    ConfigParameters

export type CreatePoolParam = {
    name: string
    symbol: string
    uri: string
    config: PublicKey
    creator: PublicKey
    baseMint: PublicKey
    quoteMint: PublicKey
    baseTokenType: TokenType
    quoteTokenType: TokenType
}

export type SwapParam = {
    owner: PublicKey
    amountIn: BN
    minAmountOut: BN
    swapBaseForQuote: boolean
}

export interface VirtualCurveClientInterface {
    swap(swapParam: SwapParameters): Promise<Transaction>
}

export type CreateClaimFeeOperatorParam = Omit<
    CreateClaimFeeOperatorAccounts,
    'program' | 'eventAuthority' | 'systemProgram'
>
export type CloseClaimFeeOperatorParam = Omit<
    CloseClaimFeeOperatorAccounts,
    'program' | 'eventAuthority' | 'systemProgram'
>

export interface VirtualCurveAdminInterface {}
