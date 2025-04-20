# Virtual Curve SDK: Function Documentation

## Table of Contents

- [Partner Functions](#partner-functions)

    - [createConfig](#createconfig)
    - [createPumpFunConfigWithLockVesting](#createPumpFunConfigWithLockVesting)
    - [createPumpFunConfigWithoutLockVesting](#createPumpFunConfigWithoutLockVesting)
    - [createPartnerMetadata](#createPartnerMetadata)
    - [claimTradingFee](#claimTradingFee)
    - [partnerWithdrawSurplus](#partnerWithdrawSurplus)
    - [withdrawLeftover](#withdrawLeftover)

-

- [Pool Functions](#pool-functions)

    - [createPool](#createPool)
    - [createPoolMetadata](#createPoolMetadata)
    - [swap](#swap)
    - [swapQuote](#swapQuote)

-

- [Migration Functions](#migration-functions)

    - [createDammMigrationMetadata](#createDammMigrationMetadata)
    - [createLocker](#createLocker)
    - [migrateToDammV1](#migrateToDammV1)
    - [lockDammV1LpToken](#lockDammV1LpToken)
    - [claimDammV1LpToken](#claimDammV1LpToken)
    - [migrateToDammV2](#migrateToDammV2)

-

- [Helper Functions](#helper-functions)
    - [getPool](#getPool)
    - [getPools](#getPools)
    - [getPoolConfig](#getPoolConfig)
    - [getPoolMigrationQuoteThreshold](#getPoolMigrationQuoteThreshold)
    - [getPoolMetadata](#getPoolMetadata)
    - [getPartnerMetadata](#getPartnerMetadata)
    - [getDammV1MigrationMetadata](#getDammV1MigrationMetadata)
    - [getLockedLpTokenAmount](#getLockedLpTokenAmount)

## Partner Functions

### createConfig

Creates a new configuration key that will dictate the behavior of all pools created with this key.

#### Function

```typescript
async createConfig(createConfigParam: CreateConfigParam): Promise<Transaction>
```

#### Parameters

```typescript
interface CreateConfigParam {
    payer: PublicKey
    config: PublicKey
    feeClaimer: PublicKey
    leftoverReceiver: PublicKey
    quoteMint: PublicKey
    poolFees: {
        baseFee: {
            cliffFeeNumerator: BN
            numberOfPeriod: number
            reductionFactor: BN
            periodFrequency: BN
            feeSchedulerMode: number
        }
        dynamicFee: {
            binStep: number
            binStepU128: BN
            filterPeriod: number
            decayPeriod: number
            reductionFactor: number
            variableFeeControl: number
            maxVolatilityAccumulator: number
        }
    }
    activationType: number
    collectFeeMode: number
    migrationOption: number
    tokenType: number
    tokenDecimal: number
    migrationQuoteThreshold: BN
    partnerLpPercentage: number
    creatorLpPercentage: number
    partnerLockedLpPercentage: number
    creatorLockedLpPercentage: number
    sqrtStartPrice: BN
    lockedVesting: {
        amountPerPeriod: BN
        cliffDurationFromMigrationTime: BN
        frequency: BN
        numberOfPeriod: BN
        cliffUnlockAmount: BN
    }
    migrationFeeOption: number
    tokenSupply: {
        preMigrationTokenSupply: BN
        postMigrationTokenSupply: BN
    }
    padding: BN[]
    curve: {
        sqrtPrice: BN
        liquidity: BN
    }[]
}
```

#### Returns

A transaction that can be partially signed and sent to the network.

#### Example

```typescript
const transaction = await client.partners.createConfig({
    payer: wallet.publicKey,
    config: config.publicKey,
    feeClaimer: wallet.publicKey,
    leftoverReceiver: wallet.publicKey,
    quoteMint: new PublicKey('So11111111111111111111111111111111111111112'),
    poolFees: {
        baseFee: {
            cliffFeeNumerator: new BN('2500000'),
            numberOfPeriod: 0,
            reductionFactor: new BN('0'),
            periodFrequency: new BN('0'),
            feeSchedulerMode: FeeSchedulerMode.Linear,
        },
        dynamicFee: {
            binStep: 1,
            binStepU128: new BN('1844674407370955'),
            filterPeriod: 10,
            decayPeriod: 120,
            reductionFactor: 1000,
            variableFeeControl: 100000,
            maxVolatilityAccumulator: 100000,
        },
    },
    activationType: 0,
    collectFeeMode: 0,
    migrationOption: 0
    tokenType: 0,
    tokenDecimal: 9,
    migrationQuoteThreshold: new BN('1000000000'),
    partnerLpPercentage: 25,
    creatorLpPercentage: 25,
    partnerLockedLpPercentage: 25,
    creatorLockedLpPercentage: 25,
    sqrtStartPrice: new BN('58333726687135158'),
    lockedVesting: {
        amountPerPeriod: new BN('0'),
        cliffDurationFromMigrationTime: new BN('0'),
        frequency: new BN('0'),
        numberOfPeriod: new BN('0'),
        cliffUnlockAmount: new BN('0'),
    },
    migrationFeeOption: 0,
    tokenSupply: {
        preMigrationTokenSupply: new BN('10000000000000000000'),
        postMigrationTokenSupply: new BN('10000000000000000000'),
    },
    padding: [
        new BN(0),
        new BN(0),
        new BN(0),
        new BN(0),
        new BN(0),
        new BN(0),
        new BN(0),
    ],
    curve: [
        {
            sqrtPrice: new BN('233334906748540631'),
            liquidity: new BN('622226417996106429201027821619672729'),
        },
        {
            sqrtPrice: new BN('79226673521066979257578248091'),
            liquidity: new BN('1'),
        },
    ],
})
```
