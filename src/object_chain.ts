import { Effect, Context } from "effect"
import { FxFn } from "./fx_fn.ts"
import { ChainTagged, ChainTag, chainTagStr } from "./chain_tag.ts"
import { UnionFromTuple, UCFxObjectStepSpec, UCPureObjectStepSpec, ObjectChainSteps } from "./object_chain_steps.ts"
import { UPObjectStepSpec, ObjectStepsReqsU, ObjectStepsErrorsU, ObjectChainStepsReturn, objectChainStepsProg } from "./object_chain_steps.ts"

// a type for a service which can run an ObjectChain
export type ObjectChainService<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]]> = {
        readonly buildObject: (i: Input) => Effect.Effect<ObjectStepsReqsU<Steps>,
            ObjectStepsErrorsU<Steps>,
            ObjectChainStepsReturn<Steps, Input>>
    }

export type ObjectChainServiceContextTag<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]]> =
    Context.Tag<ChainTag<Input>, ObjectChainService<Input, Steps>>

// get a Context.Tag for an ObjectChainService
export function objectChainServiceContextTag

    <Input extends ChainTagged,
        Steps extends readonly [...UPObjectStepSpec[]]>

    () {

    return Context.Tag<ChainTag<Input>, ObjectChainService<Input, Steps>>()
}

// a function of Input which build an Object
export type ObjectChainProgram<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]]> =
    (i: Input) => Effect.Effect<ObjectStepsReqsU<Steps>,
        ObjectStepsErrorsU<Steps>,
        ObjectChainStepsReturn<Steps, Input>>

// an ObjectChain is a datastructure defining a series of steps to build an Object.
// it can be built in a single step with objectChain, or iteratively with addSteps
export type ObjectChain<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]]> = {
        readonly tag: ChainTag<Input>
        readonly tagStr: Input['_tag']
        readonly steps: ObjectChainSteps<Steps, Input> extends readonly [...Steps] ? readonly [...Steps] : ObjectChainSteps<Steps, Input>
        readonly program: ObjectChainProgram<Input, Steps>
        readonly contextTag: ObjectChainServiceContextTag<Input, Steps>
    }

// an unparameterised version of ObjectChain for typing tuples
export type UPObjectChain = {
    // deno-lint-ignore no-explicit-any
    readonly tag: any
    readonly tagStr: string
    readonly steps: readonly [...UPObjectStepSpec[]]
    // deno-lint-ignore no-explicit-any
    readonly program: (i: any) => Effect.Effect<any, any, any>
    // deno-lint-ignore no-explicit-any
    readonly contextTag: Context.Tag<any, any>
}

// union of all the inputs from a tuple of chains
export type ObjectChainInput<T extends UPObjectChain> =
    T extends ObjectChain<infer Input, infer _Steps>
    ? Input
    : never
export type ObjectChainsInputU<Tuple extends readonly [...UPObjectChain[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ObjectChainInput<Tuple[Index]>
} & { length: Tuple['length'] }>

export type ObjectChainTagStr<T extends UPObjectChain> = 
    T extends ObjectChain<infer _Input, infer _Steps>
    ? T['tagStr']
    : never
export type ObjectChainsTagStrU<Tuple extends readonly [...UPObjectChain[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ObjectChainTagStr<Tuple[Index]>
} & { length: Tuple['length'] }>

export type ObjectChainContextTagId<T extends UPObjectChain> =
    T extends ObjectChain<infer Input, infer _Steps>
    ? ChainTag<Input>
    : never
export type ObjectChainsContextTagIdU<Tuple extends readonly [...UPObjectChain[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ObjectChainContextTagId<Tuple[Index]>
} & { length: Tuple['length'] }>


// build an ObjectChain from Steps
export function objectChain<Input extends ChainTagged>() {
    return function <Steps extends readonly [...UPObjectStepSpec[]]>
        (tag: ChainTag<Input>,
            steps: ObjectChainSteps<Steps, Input> extends readonly [...Steps] ? readonly [...Steps] : ObjectChainSteps<Steps, Input>) {

        return {
            tag: tag,
            tagStr: chainTagStr(tag),
            steps: steps,
            program: objectChainStepsProg<Input>()(steps),
            contextTag: objectChainServiceContextTag<Input, Steps>()
        } as ObjectChain<Input, Steps>
    }
}

// warning - doesn't work well - quickly gets to 
// "Type instantiation is excessively deep and possibly infinite"
//
// i think this is because the depth is  M + 2M + 3M + 4M = M(N+1)/2 = O(N^2)
// because each step has inference depth M, and a new array is created in each step
export function addSteps<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    AdditionalSteps extends readonly [...UPObjectStepSpec[]]>
    (chain: ObjectChain<Input, Steps>,
        additionalSteps: ObjectChainSteps<AdditionalSteps, ObjectChainStepsReturn<Steps, Input>> extends readonly [...AdditionalSteps]
            ? readonly [...AdditionalSteps]
            : ObjectChainSteps<AdditionalSteps, ObjectChainStepsReturn<Steps, Input>>) {

    const newSteps = [...chain.steps, ...additionalSteps] as const

    // deno-lint-ignore no-explicit-any
    return objectChain<Input>()(chain.tag, newSteps as any) as
        ObjectChain<Input, readonly [...Steps, ...AdditionalSteps]>
}

// warning - doesn't work well - see addSteps
export function addStep<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    K extends string,
    D1 extends D2,
    D2,
    R, E, V>
    (chain: ObjectChain<Input, Steps>,
        step: UCFxObjectStepSpec<K, ObjectChainStepsReturn<Steps, Input>, D1, D2, R, E, V>) {

    return addSteps(chain, [step] as const)
}

// warning - doesn't work well - see addSteps
export function addFxStep<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    K extends string,
    A extends ObjectChainStepsReturn<Steps, Input>,
    D1 extends D2,
    D2,
    R, E, V>
    (chain: ObjectChain<Input, Steps>,
        k: K,
        inFn: (a: A) => D1,
        fxFn: FxFn<D2, R, E, V>) {

    const steps = [{ k, inFn, fxFn } as
        UCFxObjectStepSpec<K,
            ObjectChainStepsReturn<Steps, Input>, D1, D2, R, E, V>] as const

    return addSteps(chain, steps)
}

// warning - doesn't work well - see addSteps
export function addPureStep<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    K extends string,
    A extends ObjectChainStepsReturn<Steps, Input>,
    V>(chain: ObjectChain<Input, Steps>,
        k: K,
        pureFn: (a: A) => V) {

    const steps = [{ k, pureFn } as
        UCPureObjectStepSpec<K,
            ObjectChainStepsReturn<Steps, Input>, V>] as const

    return addSteps(chain, steps)
}

////////////////////////////////// recursion support //////////////////////////////

// idea is that a chain will have an associated service, and we use the 
// Tag<Input> of the chain to identify the service in a Context.Tag ... 
// then we can create an FxFn using the Context.Tag which can be used
// as a computation step to recurse or run any other chain as a computation
// step



// make an ObjectChainService impl with given which will run an ObjectChain for a particular Input,
// and is identified by chain.contextTag
export function objectChainServiceImpl

    <Input extends ChainTagged,
        Steps extends readonly [...UPObjectStepSpec[]]>

    (chain: ObjectChain<Input, Steps>) {

    const service = {
        buildObject: (i: Input) => {
            return chain.program(i)
        }
    } as ObjectChainService<Input, Steps>

    return service
}

// provide an implementation of the ObjectChainService for this chain
// to an Effect
export function provideObjectChainServiceImpl
    <Input extends ChainTagged,
        Steps extends readonly [...UPObjectStepSpec[]],
        InR, InE, InV>

    (effect: Effect.Effect<InR, InE, InV>,
        chain: ObjectChain<Input, Steps>) {

    const svc = objectChainServiceImpl(chain) as
        ObjectChainService<Input, Steps>

    return Effect.provideService(effect, chain.contextTag, svc)
}

// given an ObjectChain, returns an FxFn to invoke the chain,
// which retrieves the ObjectChainService for the chain, and 
// calls it's buildObject function
export function objectChainFxFn
    <Input extends ChainTagged,
        Steps extends readonly [...UPObjectStepSpec[]]>

    (chain: ObjectChain<Input, Steps>) {

    return (i: Input) => {
        const r = Effect.gen(function* (_) {
            const svc = yield* _(chain.contextTag)
            const obj = yield* _(svc.buildObject(i))
            return obj
        })
        return r
    }
}
