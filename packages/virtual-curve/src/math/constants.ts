import BN from 'bn.js'

export const RESOLUTION = 64
export const ONE_Q64 = new BN(1).shln(RESOLUTION)
export const FEE_DENOMINATOR = 10000
export const MAX_FEE_NUMERATOR = 5000
export const BASIS_POINT_MAX = 10000
export const MAX_CURVE_POINT = 10
export const PARTNER_SURPLUS_SHARE = 20
