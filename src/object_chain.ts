import { Effect } from "effect"
import { Tagged, Tag } from "./tagged.ts"
import { UnionFromTuple, ChainObjectSteps } from "./object_builders.ts"
import { UPObjectStepSpec, ObjectStepsDepsU, ObjectStepsErrorsU, ChainObjectStepsReturn, chainObjectStepsProg } from "./object_builders.ts"

// an ObjectChain is a datastructure defining a series of steps to build an Object.
// it can be built in a single step with objectChain, or iteratively with addSteps
export type ObjectChain<Input extends Tagged,
    Steps extends readonly [...UPObjectStepSpec[]]> = {
        readonly tag: Tag<Input>
        readonly tagStr: Input['tag']
        readonly steps: ChainObjectSteps<Steps, Input> extends readonly [...Steps] ? readonly [...Steps] : ChainObjectSteps<Steps, Input>
        readonly program: (i: Input) => Effect.Effect<ObjectStepsDepsU<Steps>,
            ObjectStepsErrorsU<Steps>,
            ChainObjectStepsReturn<Steps, Input>>
    }

// an unparameterised version of ObjectChain for typing tuples
export type UPObjectChain = {
    readonly tagStr: string
    readonly steps: readonly [...UPObjectStepSpec[]]
    // deno-lint-ignore no-explicit-any
    readonly program: (i: any) => Effect.Effect<any, any, any>
}

export type ObjectChainInput<T extends UPObjectChain> =
    T extends ObjectChain<infer Input, infer _Steps>
    ? Input 
    : never
export type ObjectChainsInputU<Tuple extends readonly [...UPObjectChain[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ObjectChainInput<Tuple[Index]>
} & { length: Tuple['length'] }>
    

// build an ObjectChain from Steps
export function objectChain<Input extends Tagged>() {
    return function <Steps extends readonly [...UPObjectStepSpec[]]>
        (tag: Tag<Input>,
            steps: ChainObjectSteps<Steps, Input> extends readonly [...Steps] ? readonly [...Steps] : ChainObjectSteps<Steps, Input>) {

        return {
            tag: tag,
            tagStr: tag.tag,
            steps: steps,
            program: chainObjectStepsProg<Input>()(steps)
        } as ObjectChain<Input, Steps>
    }
}

export function addSteps<Input extends Tagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    AdditionalSteps extends readonly [...UPObjectStepSpec[]]>
    (chain: ObjectChain<Input, Steps>,
        additionalSteps: ChainObjectSteps<AdditionalSteps, ChainObjectStepsReturn<Steps, Input>> extends readonly [...AdditionalSteps]
            ? readonly [...AdditionalSteps]
            : ChainObjectSteps<AdditionalSteps, ChainObjectStepsReturn<Steps, Input>>) {

    const newSteps = [...chain.steps, ...additionalSteps] as const

    // deno-lint-ignore no-explicit-any
    return objectChain<Input>()(chain.tag, newSteps as any) as ObjectChain<Input, readonly [...Steps, ...AdditionalSteps]>
}