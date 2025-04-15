import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'

// Numbers
export const BASIS_POINT_MAX: number = 10_000
export const OFFSET: number = 64
export const U64_MAX: BN = new BN('18446744073709551615')
export const MIN_SQRT_PRICE: BN = new BN('4295048016')
export const MAX_SQRT_PRICE: BN = new BN('79226673521066979257578248091')

// Curve constants
export const MAX_CURVE_POINT = 20
export const FEE_DENOMINATOR = new BN(1_000_000_000)
export const MAX_FEE_NUMERATOR = new BN(500_000_000)
export const MAX_TOKEN_SUPPLY = new BN('1000000000')
export const SCALE_OFFSET = 64
export const ONE = new BN(1).shln(SCALE_OFFSET)

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
export const VAULT_BASE_KEY = new PublicKey(
    'HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv'
)
export const LOCKER_PROGRAM_ID = new PublicKey(
    'LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn'
)
