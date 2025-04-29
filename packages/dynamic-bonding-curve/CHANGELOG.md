# Changelog

## [1.1.1-rc.9] - 2025-04-29

### Release Notes

#### Feature Changes

- feat: added 4% and 6% graduation fee options
- feat: creatorWithdrawSurplus and claimCreatorTradingFee functions
- feat: added new getter functions
- fix: updated the way the services are called
- fix: updated the way the getters are called

#### Breaking Changes

- `createConfig`, `buildCurveAndCreateConfig` and `buildCurveAndCreateConfigByMarketCap` functions now require a `creatorTradingFeePercentage` parameter.
- IDL includes `creatorWithdrawSurplus` and `claimCreatorTradingFee` instructions.
- Partner, Migration, Creator and Pool functions are now called in this manner:
    - `client.partners.createConfig` -> `client.partner.createConfig`
    - `client.migrations.migrateToDammV1` -> `client.migration.migrateToDammV1`
    - `client.creators.createPoolMetadata` -> `client.creator.createPoolMetadata`
    - `client.pools.swap` -> `client.pool.swap`
- Getter functions are now called in this manner:
    - `client.getProgram().getPoolConfig` -> `client.getPoolConfig`