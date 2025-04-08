import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { type VirtualCurveProgram } from './types'
import type { VirtualCurve as VirtualCurveIDL } from './idl/idl'

export class VirtualCurve {
    protected program: VirtualCurveProgram

    constructor(program: Program<VirtualCurveIDL>) {
        this.program = program
    }
}
