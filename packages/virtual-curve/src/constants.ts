import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'

// Numbers
export const BASIS_POINT_MAX: number = 10_000
export const OFFSET: number = 64
export const U64_MAX: BN = new BN('18446744073709551615')
export const MIN_SQRT_PRICE: BN = new BN('4295048016')
export const MAX_SQRT_PRICE: BN = new BN('79226673521066979257578248091')

// Pubkey
export const METADATA_PROGRAM_ID = new PublicKey(
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
)
export const DAMM_V1_PROGRAM_ID = new PublicKey(
    'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'
)
export const DAMM_V2_PROGRAM_ID = new PublicKey(
    'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG'
)
export const VAULT_BASE_KEY = new PublicKey(
    'HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv'
)
