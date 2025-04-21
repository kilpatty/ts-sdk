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

Refer to the [docs](docs.md) for more information.

### Test

```bash
bun install
bun test
```

### Program Address

- Mainnet-beta: virEFLZsQm1iFAs8py1XnziJ67gTzW2bfCWhxNPfccD
- Devnet: virEFLZsQm1iFAs8py1XnziJ67gTzW2bfCWhxNPfccD

### Config key for migration

#### DAMM V1:

- migration_fee_option == 0: EtwbXRxV8b46Vkho5EhMshi9qEU7xv6sMQnPHK3fX8WR
- migration_fee_option == 1: VEtZapzJXreco3cbzUT8ZszawsRvRRQzGN5GBaCMwWh
- migration_fee_option == 2: 8z2tYtwiAkby1tMSdf1hG2Ni8MFBk43o9tYey5zegNDh
- migration_fee_option == 3: 3BuQgW3g75azhKeE3yzaqeWkmwezuDGwF6FT5py3mFrt

#### DAMM V2:

- migration_fee_option == 0: 96gRhsiKyBJnXT2GxEnh54b9YLjzpEJ4aTetvLmQ5tWj
- migration_fee_option == 1: 3GZLmQJ98xPRLNJjofzK3bfvhU11WFCiZJhEuPwgfBHb
- migration_fee_option == 2: 7aqweHmWjiMJEVzTXjvpEasRiDQSK79GNWPqjbkeWtyL
- migration_fee_option == 3: 6ym6zMi5RqUH3k2BNdiXUtSdpeypdWMLsxTyRhKqzhz2
