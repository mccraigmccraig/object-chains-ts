import { Effect, Context } from "effect"
import { ChainTagged, ChainTag, chainTagStr } from "./chain_tag.ts"
import { UnionFromTuple, ChainObjectSteps } from "./object_builders.ts"
import { UPObjectStepSpec, ObjectStepsDepsU, ObjectStepsErrorsU, ChainObjectStepsReturn, chainObjectStepsProg } from "./object_builders.ts"

// an ObjectChain is a datastructure defining a series of steps to build an Object.
// it can be built in a single step with objectChain, or iteratively with addSteps
export type ObjectChain<Input extends ChainTagged,
    Steps extends readonly [...UPObjectStepSpec[]]> = {
        readonly tag: ChainTag<Input>
        readonly tagStr: Input['_chainTag']
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
export function objectChain<Input extends ChainTagged>() {
    return function <Steps extends readonly [...UPObjectStepSpec[]]>
        (tag: ChainTag<Input>,
            steps: ChainObjectSteps<Steps, Input> extends readonly [...Steps] ? readonly [...Steps] : ChainObjectSteps<Steps, Input>) {

        return {
            tag: tag,
            tagStr: chainTagStr(tag),
            steps: steps,
            program: chainObjectStepsProg<Input>()(steps)
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
    return objectChain<Input>()(chain.tag, newSteps as any) as ObjectChain<Input, readonly [...Steps, ...AdditionalSteps]>
}

////////////////////////////////// recursion support //////////////////////////////

// idea is that a chain will have an associated service, and we use the 
// Tag<Input> of the chain to identify the service in a Context.Tag ... 
// then we can create an FxFn using the Context.Tag which can be used
// as a computation step to recurse or run any other chain as a computation
// step

// a type for a service which can run an ObjectChain
export type ObjectChainService<Input extends ChainTagged, R, E, V extends ChainTagged> = {
    readonly buildObject: (i: Input) => Effect.Effect<R, E, V>
}

export type ObjectChainServiceContextTag<Input extends ChainTagged, R, E, V extends ChainTagged> =
    Context.Tag<ChainTag<Input>, ObjectChainService<Input, R, E, V>>

// get a Context.Tag for an ObjectChainService
export function objectChainServiceContextTag

    <Chain extends ObjectChain<Input, Steps>,
        Input extends ChainTagged,
        Steps extends readonly [...UPObjectStepSpec[]]>

    (_chain: Chain) {

    return Context.Tag<ChainTag<Input>,
        ObjectChainService<Input,
            ObjectStepsDepsU<Steps>,
            ObjectStepsErrorsU<Steps>,
            ChainObjectStepsReturn<Steps, Input>>>()
}


// make an ObjectChainService impl with given Id which will run an ObjectChain for a particular Input
// ooo - maybe the Context.Tag Id type should also be the Tagged type - would be a nice symmetry
// and avoid boilerplate
export function makeObjectChainServiceImpl

    <Chain extends ObjectChain<Input, Steps>,
        Input extends ChainTagged,
        Steps extends readonly [...UPObjectStepSpec[]]>

    (chain: Chain) {

    const service = {
        buildObject: (i: Input) => {
            return chain.program(i)
        }
    } as ObjectChainService<Input,
        ObjectStepsDepsU<Steps>,
        ObjectStepsErrorsU<Steps>,
        ChainObjectStepsReturn<Steps, Input>>

    return service
}


// provide an implementation of the ObjectChainService for this chain
// to an Effect
export function provideObjectChainServiceImpl
    <Chain extends ObjectChain<Input, Steps>,
        Input extends ChainTagged,
        Steps extends readonly [...UPObjectStepSpec[]],        
        InR, InE, InV>

    (effect: Effect.Effect<InR, InE, InV>,
        contextTag: ObjectChainServiceContextTag<Input,
            ObjectStepsDepsU<Steps>,
            ObjectStepsErrorsU<Steps>,
            ChainObjectStepsReturn<Steps, Input>>,
        chain: Chain) {

    const svc = makeObjectChainServiceImpl(chain) as
        ObjectChainService<Input,
            ObjectStepsDepsU<Steps>,
            ObjectStepsErrorsU<Steps>,
            ChainObjectStepsReturn<Steps, Input>>

    return Effect.provideService(effect, contextTag, svc)
}

export function runObjectChainFxFn
    <ContextTag extends ObjectChainServiceContextTag<Input, R, E, V>,
        Input extends ChainTagged,
        R,
        E,
        V extends ChainTagged>

    (tag: ContextTag) {

    return (i: Input) => {
        const r = Effect.gen(function* (_) {
            const svc = yield* _(tag)
            const obj = yield* _(svc.buildObject(i))
            return obj
        })
        return r
    }
}
