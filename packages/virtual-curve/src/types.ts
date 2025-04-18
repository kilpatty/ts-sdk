import type {
    Accounts,
    BN,
    IdlAccounts,
    IdlTypes,
    Program,
} from '@coral-xyz/anchor'
import type { VirtualCurve } from './idl/virtual-curve/idl'
import type { PublicKey } from '@solana/web3.js'
// Program Type
export type VirtualCurveProgram = Program<VirtualCurve>

/////////////////
// IX ACCOUNTS //
/////////////////

export type ClaimProtocolFeeAccounts = Accounts<
    VirtualCurve['instructions']['0']
>['claimProtocolFee']

export type ClaimTradingFeeAccounts = Accounts<
    VirtualCurve['instructions']['1']
>['claimTradingFee']

export type CloseClaimFeeOperatorAccounts = Accounts<
    VirtualCurve['instructions']['2']
>['closeClaimFeeOperator']

export type CreateClaimFeeOperatorAccounts = Accounts<
    VirtualCurve['instructions']['3']
>['createClaimFeeOperator']

export type CreateConfigAccounts = Accounts<
    VirtualCurve['instructions']['4']
>['createConfig']

export type CreateLockerAccounts = Accounts<
    VirtualCurve['instructions']['5']
>['createLocker']

export type CreatePartnerMetadata = Accounts<
    VirtualCurve['instructions']['6']
>['createPartnerMetadata']

export type CreateVirtualPoolMetadata = Accounts<
    VirtualCurve['instructions']['7']
>['createVirtualPoolMetadata']

export type InitializeVirtualPoolWithSplTokenAccounts = Accounts<
    VirtualCurve['instructions']['8']
>['initializeVirtualPoolWithSplToken']

export type InitializeVirtualPoolWithToken2022Accounts = Accounts<
    VirtualCurve['instructions']['9']
>['initializeVirtualPoolWithToken2022']

export type MigrateMeteoraDammAccounts = Accounts<
    VirtualCurve['instructions']['10']
>['migrateMeteoraDamm']

export type MigrateMeteoraDammClaimLpTokenAccounts = Accounts<
    VirtualCurve['instructions']['11']
>['migrateMeteoraDammClaimLpToken']

export type MigrateMeteoraDammLockLpTokenAccounts = Accounts<
    VirtualCurve['instructions']['12']
>['migrateMeteoraDammLockLpToken']

export type MigrationDammV2Accounts = Accounts<
    VirtualCurve['instructions']['13']
>['migrationDammV2']

export type MigrationDammV2CreateMetadataAccounts = Accounts<
    VirtualCurve['instructions']['14']
>['migrationDammV2CreateMetadata']

export type MigrationMeteoraDammCreateMetadataAccounts = Accounts<
    VirtualCurve['instructions']['15']
>['migrationMeteoraDammCreateMetadata']

export type PartnerWithdrawSurplusAccounts = Accounts<
    VirtualCurve['instructions']['16']
>['partnerWithdrawSurplus']

export type SwapAccounts = Accounts<VirtualCurve['instructions']['18']>['swap']

///////////////
// IDL Types //
///////////////

export type ConfigParameters = IdlTypes<VirtualCurve>['configParameters']
export type InitializePoolParameters =
    IdlTypes<VirtualCurve>['initializePoolParameters']
export type SwapParameters = IdlTypes<VirtualCurve>['swapParameters']
export type PoolFeeParameters = IdlTypes<VirtualCurve>['poolFeeParameters']
export type DynamicFeeParameters =
    IdlTypes<VirtualCurve>['dynamicFeeParameters']
export type LiquidityDistributionParameters =
    IdlTypes<VirtualCurve>['liquidityDistributionParameters']
export type PoolFeesConfig = IdlTypes<VirtualCurve>['poolFeesConfig']
export type DynamicFeeConfig = IdlTypes<VirtualCurve>['dynamicFeeConfig']
export type BaseFeeConfig = IdlTypes<VirtualCurve>['baseFeeConfig']
export type PoolFees = IdlTypes<VirtualCurve>['poolFees']
export type PoolMetrics = IdlTypes<VirtualCurve>['poolMetrics']
export type SwapResult = IdlTypes<VirtualCurve>['swapResult']
export type CreatePartnerMetadataParameters =
    IdlTypes<VirtualCurve>['createPartnerMetadataParameters']
export type CreateVirtualPoolMetadataParameters =
    IdlTypes<VirtualCurve>['createVirtualPoolMetadataParameters']

//////////////////
// IDL ACCOUNTS //
//////////////////
export type ClaimFeeOperator = IdlAccounts<VirtualCurve>['claimFeeOperator']
export type Config = IdlAccounts<VirtualCurve>['config']
export type MeteoraDammMigrationMetadata =
    IdlAccounts<VirtualCurve>['meteoraDammMigrationMetadata']
export type VolatilityTracker = IdlTypes<VirtualCurve>['volatilityTracker']
export type VirtualPool = IdlAccounts<VirtualCurve>['virtualPool']
export type PoolConfig = IdlAccounts<VirtualCurve>['poolConfig']
export type PartnerMetadata = IdlAccounts<VirtualCurve>['partnerMetadata']
export type VirtualPoolMetadata =
    IdlAccounts<VirtualCurve>['virtualPoolMetadata']

///////////
// ENUMS //
///////////

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

export enum CollectFeeMode {
    QuoteToken = 0,
    OutputToken = 1,
}

export enum FeeSchedulerMode {
    Linear = 0,
    Exponential = 1,
}

export enum MigrationFeeOption {
    FixedBps25 = 0,
    FixedBps30 = 1,
    FixedBps100 = 2,
    FixedBps200 = 3,
}

export enum TokenDecimal {
    SIX = 6,
    NINE = 9,
}

/**
 * Trade direction
 */
export enum TradeDirection {
    BaseToQuote = 0,
    QuoteToBase = 1,
}

export enum Rounding {
    Up,
    Down,
}

///////////
// TYPES //
///////////

export type CreateConfigParam = Omit<
    CreateConfigAccounts,
    'program' | 'eventAuthority' | 'systemProgram'
> &
    ConfigParameters

export type CreatePumpFunConfigParam = {
    config: PublicKey
    feeClaimer: PublicKey
    owner: PublicKey
    payer: PublicKey
    quoteMint: PublicKey
}

export type CreateDammMigrationMetadataParam = {
    payer: PublicKey
    virtualPool: PublicKey
    config: PublicKey
    migrateToDammV2: boolean
}

export type CreateCurveParam = {
    tokenDecimal: TokenDecimal
    migrationQuoteThreshold: BN
    tokenBaseSupply: BN
    migrationBasePercent: number
}

export type CreateCurveResponse = {
    sqrtStartPrice: BN
    curve: LiquidityDistributionParameters[]
}

export type MigrateToDammV1Param = {
    payer: PublicKey
    virtualPool: PublicKey
    dammConfig: PublicKey
}

export type MigrateToDammV2Param = {
    payer: PublicKey
    virtualPool: PublicKey
    dammConfig: PublicKey
}

export type ClaimTradingFeeParam = {
    feeClaimer: PublicKey
    pool: PublicKey
    maxBaseAmount: BN
    maxQuoteAmount: BN
}

export type CreateVirtualPoolMetadataParam = {
    virtualPool: PublicKey
    name: string
    website: string
    logo: string
    creator: PublicKey
    payer: PublicKey
}

export type CreatePartnerMetadataParam = {
    name: string
    website: string
    logo: string
    feeClaimer: PublicKey
    payer: PublicKey
}

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
    minimumAmountOut: BN
    swapBaseForQuote: boolean
}

export type DammLpTokenParam = {
    payer: PublicKey
    virtualPool: PublicKey
    dammConfig: PublicKey
    isPartner: boolean
}

export type PartnerWithdrawSurplusParam = {
    feeClaimer: PublicKey
    virtualPool: PublicKey
}

export type CreateLockerParam = {
    payer: PublicKey
    virtualPool: PublicKey
}

////////////////
// INTERFACES //
////////////////

export interface FeeResult {
    amount: BN
    protocolFee: BN
    tradingFee: BN
    referralFee: BN
}

export interface FeeMode {
    feesOnInput: boolean
    feesOnBaseToken: boolean
    hasReferral: boolean
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

export interface FeeOnAmountResult {
    amount: BN // Amount remaining after taking trading fee
    protocolFee: BN // Final protocol fee (after referral deduction)
    tradingFee: BN // Portion of trading fee NOT going to protocol
    referralFee: BN // Referral fee amount
}

export interface PrepareSwapParams {
    inputMint: PublicKey
    outputMint: PublicKey
    inputTokenProgram: PublicKey
    outputTokenProgram: PublicKey
}

export interface SwapAmount {
    outputAmount: BN
    nextSqrtPrice: BN
}
