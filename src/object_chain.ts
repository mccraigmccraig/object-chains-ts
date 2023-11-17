import { Effect, Context } from "effect"
import { FxFn } from "./fx_fn.ts"
import { ChainTagged, ChainTag, chainTagStr } from "./chain_tag.ts"
import { UnionFromTuple, UCFxObjectStepSpec, UCPureObjectStepSpec, ChainObjectSteps } from "./object_builders.ts"
import { UPObjectStepSpec, ObjectStepsDepsU, ObjectStepsErrorsU, ChainObjectStepsReturn, chainObjectStepsProg } from "./object_builders.ts"

// a type for a service which can run an ObjectChain
export type ObjectBuilderService<Input extends ChainTagged, R, E, V extends ChainTagged> = {
    readonly buildObject: (i: Input) => Effect.Effect<R, E, V>
}

export type ObjectBuilderServiceContextTag<Input extends ChainTagged, R, E, V extends ChainTagged> =
    Context.Tag<ChainTag<Input>, ObjectBuilderService<Input, R, E, V>>

export type ObjectChainService<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]]> =
    ObjectBuilderService<Input,
        ObjectStepsDepsU<Steps>,
        ObjectStepsErrorsU<Steps>,
        ChainObjectStepsReturn<Steps, Input>>

export type ObjectChainServiceContextTag<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]]> =
    ObjectBuilderServiceContextTag<Input,
        ObjectStepsDepsU<Steps>,
        ObjectStepsErrorsU<Steps>,
        ChainObjectStepsReturn<Steps, Input>>

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
    (i: Input) => Effect.Effect<ObjectStepsDepsU<Steps>,
        ObjectStepsErrorsU<Steps>,
        ChainObjectStepsReturn<Steps, Input>>

// an ObjectChain is a datastructure defining a series of steps to build an Object.
// it can be built in a single step with objectChain, or iteratively with addSteps
export type ObjectChain<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]]> = {
        readonly tag: ChainTag<Input>
        readonly tagStr: Input['_chainTag']
        readonly steps: ChainObjectSteps<Steps, Input> extends readonly [...Steps] ? readonly [...Steps] : ChainObjectSteps<Steps, Input>
        readonly program: ObjectChainProgram<Input, Steps>
        readonly contextTag: ObjectChainServiceContextTag<Input, Steps>
    }

// an unparameterised version of ObjectChain for typing tuples
export type UPObjectChain = {
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
            steps: ChainObjectSteps<Steps, Input> extends readonly [...Steps] ? readonly [...Steps] : ChainObjectSteps<Steps, Input>) {

        return {
            tag: tag,
            tagStr: chainTagStr(tag),
            steps: steps,
            program: chainObjectStepsProg<Input>()(steps),
            contextTag: objectChainServiceContextTag<Input, Steps>()
        } as ObjectChain<Input, Steps>
    }
}

export function addSteps<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    AdditionalSteps extends readonly [...UPObjectStepSpec[]]>
    (chain: ObjectChain<Input, Steps>,
        additionalSteps: ChainObjectSteps<AdditionalSteps, ChainObjectStepsReturn<Steps, Input>> extends readonly [...AdditionalSteps]
            ? readonly [...AdditionalSteps]
            : ChainObjectSteps<AdditionalSteps, ChainObjectStepsReturn<Steps, Input>>) {

    const newSteps = [...chain.steps, ...additionalSteps] as const

    // deno-lint-ignore no-explicit-any
    return objectChain<Input>()(chain.tag, newSteps as any) as
        ObjectChain<Input, readonly [...Steps, ...AdditionalSteps]>
}

export function addStep<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    K extends string,
    D1 extends D2,
    D2,
    R, E, V>
    (chain: ObjectChain<Input, Steps>,
        step: UCFxObjectStepSpec<K, ChainObjectStepsReturn<Steps, Input>, D1, D2, R, E, V>) {

    return addSteps(chain, [step] as const)
}

export function addFxStep<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    K extends string,
    A extends ChainObjectStepsReturn<Steps, Input>,
    D1 extends D2,
    D2,
    R, E, V>
    (chain: ObjectChain<Input, Steps>,
        k: K,
        inFn: (a: A) => D1,
        fxFn: FxFn<D2, R, E, V>) {

    const steps = [{ k, inFn, fxFn } as
        UCFxObjectStepSpec<K,
            ChainObjectStepsReturn<Steps, Input>, D1, D2, R, E, V>] as const

    return addSteps(chain, steps)
}

export function addPureStep<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]],
    K extends string,
    A extends ChainObjectStepsReturn<Steps, Input>,
    V>(chain: ObjectChain<Input, Steps>,
        k: K,
        pureFn: (a: A) => V) {

    const steps = [{ k, pureFn } as
        UCPureObjectStepSpec<K,
            ChainObjectStepsReturn<Steps, Input>, V>] as const

    return addSteps(chain, steps)
}

////////////////////////////////// recursion support //////////////////////////////

// idea is that a chain will have an associated service, and we use the 
// Tag<Input> of the chain to identify the service in a Context.Tag ... 
// then we can create an FxFn using the Context.Tag which can be used
// as a computation step to recurse or run any other chain as a computation
// step



// make an ObjectChainService impl with given Id which will run an ObjectChain for a particular Input
// ooo - maybe the Context.Tag Id type should also be the Tagged type - would be a nice symmetry
// and avoid boilerplate
export function makeObjectChainServiceImpl

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
        contextTag: ObjectChainServiceContextTag<Input, Steps>,
        chain: ObjectChain<Input, Steps>) {

    const svc = makeObjectChainServiceImpl(chain) as
        ObjectChainService<Input, Steps>

    return Effect.provideService(effect, contextTag, svc)
}

// given a Context.Tag for an ObjectBuilderService, return 
// an FxFn to build an Object
export function objectChainFxFn
    <Input extends ChainTagged,
        R,
        E,
        V extends ChainTagged>

    (tag: ObjectBuilderServiceContextTag<Input, R, E, V>) {

    return (i: Input) => {
        const r = Effect.gen(function* (_) {
            const svc = yield* _(tag)
            const obj = yield* _(svc.buildObject(i))
            return obj
        })
        return r
    }
}
