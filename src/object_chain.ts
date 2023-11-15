import { Effect } from "effect"
import { Tagged, Tag } from "./tagged.ts"
import { ChainObjectSteps } from "./object_builders.ts"
import { UPObjectStepSpec, ObjectStepsDepsU, ObjectStepsErrorsU, ChainObjectStepsReturn, chainObjectStepsProg } from "./object_builders.ts"

// an ObjectChain is a datastructure defining a series of steps to build an Object.
// it can be built in a single step with objectChain, or iteratively with addSteps
export type ObjectChain<Obj extends Tagged,
    Steps extends readonly [...UPObjectStepSpec[]]> = {
        readonly tag: Tag<Obj>
        readonly tagStr: Obj['tag']
        readonly steps: ChainObjectSteps<Steps, Obj> extends readonly [...Steps] ? readonly [...Steps] : ChainObjectSteps<Steps, Obj>
        readonly program: (obj: Obj) => Effect.Effect<ObjectStepsDepsU<Steps>,
            ObjectStepsErrorsU<Steps>,
            ChainObjectStepsReturn<Steps, Obj>>
    }

// an unparameterised version of ObjectChain for typing tuples
export type UPObjectChain = {
    readonly tagStr: string
    readonly steps: readonly [...UPObjectStepSpec[]]
    // deno-lint-ignore no-explicit-any
    readonly program: (obj: any) => Effect.Effect<any, any, any>
}

export type ObjectChainInput<T extends UPObjectChain> =
    T extends ObjectChain<infer Input, infer _Steps>
    ? Input 
    : never
export type ObjectChainsInputTuple<Tuple extends readonly [...UPObjectChain[]]> = {
    +readonly [Index in keyof Tuple]: ObjectChainInput<Tuple[Index]>
} & { length: Tuple['length'] }
    

// build an ObjectChain from Steps
export function objectChain<Obj extends Tagged>() {
    return function <Steps extends readonly [...UPObjectStepSpec[]]>
        (tag: Tag<Obj>,
            steps: ChainObjectSteps<Steps, Obj> extends readonly [...Steps] ? readonly [...Steps] : ChainObjectSteps<Steps, Obj>) {

        return {
            tag: tag,
            tagStr: tag.tag,
            steps: steps,
            program: chainObjectStepsProg<Obj>()(steps)
        } as ObjectChain<Obj, Steps>
    }
}

export function addSteps<Obj extends Tagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    AdditionalSteps extends readonly [...UPObjectStepSpec[]]>
    (chain: ObjectChain<Obj, Steps>,
        additionalSteps: ChainObjectSteps<AdditionalSteps, ChainObjectStepsReturn<Steps, Obj>> extends readonly [...AdditionalSteps[]]
            ? readonly [...AdditionalSteps[]]
            : ChainObjectSteps<AdditionalSteps, ChainObjectStepsReturn<Steps, Obj>>) {

    const newSteps = [...chain.steps, ...additionalSteps] as const

    // deno-lint-ignore no-explicit-any
    return objectChain<Obj>()(chain.tag, newSteps as any) as ObjectChain<Obj, readonly [...Steps, ...AdditionalSteps]>
}