# Meteora Dynamic Bonding Curve SDK

A Typescript SDK for interacting with the Dynamic Bonding Curve on Meteora.

## Overview

This SDK provides a set of tools and methods to interact with the [Meteora Dynamic Bonding Curve](https://github.com/MeteoraAg/ts-sdk/tree/main/packages/dynamic-bonding-curve). It enables developers to easily create and manage dynamic bonding curves, with support for custom configurations and fee structures.

## Installation

```bash
pnpm install @meteora-ag/dynamic-bonding-curve-sdk
# or
yarn add @meteora-ag/dynamic-bonding-curve-sdk
```

## Initialization

```bash
import { Connection } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";

const connection = new Connection('https://api.mainnet-beta.solana.com')
const client = new DynamicBondingCurveClient(connection)
```

## Usage

Refer to the [docs](./docs.md) for more information.

### Test

```bash
bun install
bun test
```

### Program Address

- Mainnet-beta: dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN
- Devnet: dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN

### Config key for migration

#### DAMM V1:

- migration_fee_option == 0: 8f848CEy8eY6PhJ3VcemtBDzPPSD4Vq7aJczLZ3o8MmX
- migration_fee_option == 1: HBxB8Lf14Yj8pqeJ8C4qDb5ryHL7xwpuykz31BLNYr7S
- migration_fee_option == 2: 7v5vBdUQHTNeqk1HnduiXcgbvCyVEZ612HLmYkQoAkik
- migration_fee_option == 3: EkvP7d5yKxovj884d2DwmBQbrHUWRLGK6bympzrkXGja

#### DAMM V2:

- migration_fee_option == 0: 7F6dnUcRuyM2TwR8myT1dYypFXpPSxqwKNSFNkxyNESd
- migration_fee_option == 1: 2nHK1kju6XjphBLbNxpM5XRGFj7p9U8vvNzyZiha1z6k
- migration_fee_option == 2: Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp
- migration_fee_option == 3: 2c4cYd4reUYVRAB9kUUkrq55VPyy2FNQ3FDL4o12JXmq
