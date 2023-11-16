import { Effect, Context } from "effect"
import { FxFn } from "./fx_fn.ts"
import { Tagged, Tag, tagStr } from "./tagged.ts"
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
            tagStr: tagStr(tag),
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

// a type for a service which can run an ObjectChain
export type ObjectChainService<Input extends Tagged, R, E, V extends Tagged> = {
    readonly buildObject: (i: Input) => Effect.Effect<R, E, V>
}

export type ObjectChainServiceTag<Input extends Tagged, R, E, V extends Tagged> =
    Context.Tag<Tag<Input>, ObjectChainService<Input, R, E, V>>

export type RunObjectChainFxFn<Input extends Tagged, R, E, V extends Tagged> = FxFn<Input, R, E, V>

// make an ObjectChainService impl with given Id which will run an ObjectChain for a particular Input
// ooo - maybe the Context.Tag Id type should also be the Tagged type - would be a nice symmetry
// and avoid boilerplate
export function makeObjectChainServiceImpl
    <Input extends Tagged,
        Steps extends readonly [...UPObjectStepSpec[]],
        Chain extends ObjectChain<Input, Steps>,
        R, E, V extends Tagged>
    (_contextTag: ObjectChainServiceTag<Input, R, E, V>,
        _chain: Chain) {
    return undefined as unknown as ObjectChainService<Input, R, E, V>
}

// provide an implementation of the ObjectChainService for this chain
// to an Effect
export function provideObjectChainServiceImpl
    <Input extends Tagged,
        Steps extends readonly [...UPObjectStepSpec[]],
        Chain extends ObjectChain<Input, Steps>,
        R, E, V extends Tagged>
    (effect: Effect.Effect<any, any, any>,
        contextTag: ObjectChainServiceTag<Input, R, E, V>,
        chain: Chain) {

    return Effect.provideService(effect, contextTag, makeObjectChainServiceImpl(contextTag, chain as any))
}


export function runObjectChainFxFn
    <ContextTag extends ObjectChainServiceTag<Input, R, E, V>, Input extends Tagged, R, E, V extends Tagged>
    (_tag: ContextTag) {
    return undefined as unknown as Effect.Effect<R, E, V>
}
