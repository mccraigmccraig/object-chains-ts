import { Effect, Context } from "effect"
import { FxFn } from "./fx_fn.ts"
import * as cons from "./cons_list.ts"
import { ChainTagged, ChainTag } from "./chain_tag.ts"
import * as ctag from "./chain_tag.ts"
import {
    CastUCObjectStepSpec,
    UCFxObjectStepSpec, UCPureObjectStepSpec,
    UPFxObjectStepSpec, CastUCFxObjectStepSpec,
    UPPureObjectStepSpec, CastUCPureObjectStepSpec,
    ObjectChainSteps, UPObjectStepSpec,
    ObjectStepsTupleReqsU,
    ObjectStepsErrorsU, ObjectChainStepsReturn, objectChainStepsProg
} from "./object_chain_steps.ts"

// an effectful function of Input which build an Object
export type ObjectChainProgram<Input extends ChainTagged,
    Steps extends cons.NRConsList<UPObjectStepSpec>> =
    (i: Input) => Effect.Effect<
        ObjectStepsTupleReqsU<Steps>,
        ObjectStepsErrorsU<Steps>,
        ObjectChainStepsReturn<Steps, Input>
    >

// a type for a service which can run an ObjectChain
export type ObjectChainService<Input extends ChainTagged,
    Steps extends cons.NRConsList<UPObjectStepSpec>> = {
        readonly buildObject: ObjectChainProgram<Input, Steps>
    }

export type ObjectChainServiceContextTag<Input extends ChainTagged,
    Steps extends cons.NRConsList<UPObjectStepSpec>> =
    Context.Tag<ChainTag<Input>, ObjectChainService<Input, Steps>>

// get a Context.Tag for an ObjectChainService
export function objectChainServiceContextTag
    <Input extends ChainTagged,
        Steps extends cons.NRConsList<UPObjectStepSpec>>
    () {
    return Context.Tag<ChainTag<Input>, ObjectChainService<Input, Steps>>()
}

// an ObjectChain is a datastructure defining a series of steps to build an 
// Object. it can be built in a single step with objectChain, or iteratively 
// with addSteps
export type ObjectChain<Input extends ChainTagged,
    Steps extends cons.NRConsList<UPObjectStepSpec>,
    // this param is only here so that a chain value's IntelliSense 
    // shows the chain's return type
    _Return = ObjectChainStepsReturn<Steps, Input>> = {

        readonly tag: ChainTag<Input>
        readonly tagStr: Input['_tag']

        readonly steps: Steps extends ObjectChainSteps<Steps, Input>
        ? Steps
        : ObjectChainSteps<Steps, Input>

        readonly program: ObjectChainProgram<Input, Steps>
        readonly contextTag: ObjectChainServiceContextTag<Input, Steps>
    }

// an unparameterised version of ObjectChain for typing lists
export type UPObjectChain = {
    // deno-lint-ignore no-explicit-any
    readonly tag: any
    readonly tagStr: string
    readonly steps: cons.NRConsList<UPObjectStepSpec>
    // deno-lint-ignore no-explicit-any
    readonly program: (i: any) => Effect.Effect<any, any, any>
    // deno-lint-ignore no-explicit-any
    readonly contextTag: Context.Tag<any, any>
}

// some type utilities to infer parameters from a
// UPObjectChain without first inferring the parameterised
// ObjectChain - which avoids some type instantiation depth
// errors 
export type UPObjectChainInput<T extends UPObjectChain> =
    T['tag'] extends ChainTag<infer Input>
    ? Input
    : never

export type UPObjectChainContextTag<T extends UPObjectChain> =
    T['tag'] extends ChainTag<infer Input>
    ? ChainTag<Input>
    : never

export type UPObjectChainProgramReqs<T extends UPObjectChain> =
    ReturnType<T['program']> extends Effect.Effect<infer R, infer _E, infer _V>
    ? R
    : never

export type UPObjectChainProgramErrors<T extends UPObjectChain> =
    ReturnType<T['program']> extends Effect.Effect<infer _R, infer E, infer _V>
    ? E
    : never

export type UPObjectChainProgramValue<T extends UPObjectChain> =
    ReturnType<T['program']> extends Effect.Effect<infer _R, infer _E, infer V>
    ? V
    : never


// build an ObjectChain from Steps
export function objectChain<Input extends ChainTagged>() {
    return function <const Steps extends cons.NRConsList<UPObjectStepSpec>>
        (tag: ChainTag<Input>,

            steps: Steps extends ObjectChainSteps<Steps, Input>
                ? Steps
                : ObjectChainSteps<Steps, Input>) {

        const tagStr = ctag.tag(tag)
        const program = objectChainStepsProg<Input>()(steps)
        const contextTag = objectChainServiceContextTag<Input, Steps>()

        return {
            tag,
            tagStr,
            steps,
            program,
            contextTag
        } as ObjectChain<Input, Steps>
    }
}

// add a FxStep to an ObjectChain, returning a new ObjectChain
export function addStep
    <Input extends ChainTagged,
        const Steps extends cons.NRConsList<UPObjectStepSpec>,
        NewStep extends UPObjectStepSpec>

    (chain: ObjectChain<Input, Steps>,
        step: NewStep extends CastUCObjectStepSpec<NewStep>
            ? NewStep
            : CastUCObjectStepSpec<NewStep>) {

    const newSteps =
        // deno-lint-ignore no-explicit-any
        cons.append<UPObjectStepSpec>()(chain.steps as any, step)

    // deno-lint-ignore no-explicit-any
    return objectChain<Input>()(chain.tag, newSteps as any) as
        ObjectChain<Input, cons.Append<UPObjectStepSpec, Steps, NewStep>>
}


// add an FxStep to an ObjectChain, returning a new ObjectChain
export function addFxStep
    <Input extends ChainTagged,
        const Steps extends cons.NRConsList<UPObjectStepSpec>,
        NewStep extends UPFxObjectStepSpec>

    (chain: ObjectChain<Input, Steps>,
        step: NewStep extends CastUCFxObjectStepSpec<NewStep>
            ? NewStep
            : CastUCFxObjectStepSpec<NewStep>) {

    const newSteps =
        // deno-lint-ignore no-explicit-any
        cons.append<UPObjectStepSpec>()(chain.steps as any, step)

    // deno-lint-ignore no-explicit-any
    return objectChain<Input>()(chain.tag, newSteps as any) as
        ObjectChain<Input, cons.Append<UPObjectStepSpec, Steps, NewStep>>
}

// make an FxStep at the end of an ObjectChain, returning a new ObjectChain
export function makeFxStep
    <Input extends ChainTagged,
        const Steps extends cons.NRConsList<UPObjectStepSpec>,
        K extends string,
        A extends ObjectChainStepsReturn<Steps, Input>,
        D1 extends D2,
        D2,
        R, E, V>

    (chain: ObjectChain<Input, Steps>,
        k: K,
        inFn: (a: A) => D1,
        fxFn: FxFn<D2, R, E, V>) {

    const step = { k, inFn, fxFn } as
        UCFxObjectStepSpec<K,
            ObjectChainStepsReturn<Steps, Input>, D1, D2, R, E, V>

    return addFxStep(chain, step)
}

// add a PureStep to an ObjectChain, returning a new ObjectChain
export function addPureStep
    <Input extends ChainTagged,
        const Steps extends cons.NRConsList<UPObjectStepSpec>,
        NewStep extends UPPureObjectStepSpec>

    (chain: ObjectChain<Input, Steps>,
        step: NewStep extends CastUCPureObjectStepSpec<NewStep>
            ? NewStep
            : CastUCPureObjectStepSpec<NewStep>) {

    const newSteps =
        // deno-lint-ignore no-explicit-any
        cons.append<UPObjectStepSpec>()(chain.steps as any, step)

    // deno-lint-ignore no-explicit-any
    return objectChain<Input>()(chain.tag, newSteps as any) as
        ObjectChain<Input, cons.Append<UPObjectStepSpec, Steps, NewStep>>
}

// make a PureStep at the end of an ObjectChain, returning a new ObjectChain
export function makePureStep
    <Input extends ChainTagged,
        const Steps extends cons.NRConsList<UPObjectStepSpec>,
        K extends string,
        A extends ObjectChainStepsReturn<Steps, Input>,
        V>(chain: ObjectChain<Input, Steps>,
            k: K,
            pureFn: (a: A) => V) {

    const step = { k, pureFn } as
        UCPureObjectStepSpec<K,
            ObjectChainStepsReturn<Steps, Input>, V>

    return addPureStep(chain, step)
}

// return a new ObjectChain with the addSteps concatenated
export function concatSteps
    <Input extends ChainTagged,
        const ChainSteps extends cons.NRConsList<UPObjectStepSpec>,
        const AddSteps extends cons.NRConsList<UPObjectStepSpec>>
    (chain: ObjectChain<Input, ChainSteps>,
        addSteps: AddSteps extends cons.ConsList<UPObjectStepSpec, AddSteps>
            ? AddSteps
            : cons.ConsList<UPObjectStepSpec, AddSteps>) {

    const newSteps =
        // deno-lint-ignore no-explicit-any
        cons.concat<UPObjectStepSpec>()(chain.steps as any, addSteps as any)

    // deno-lint-ignore no-explicit-any
    return objectChain<Input>()(chain.tag, newSteps as any) as
        ObjectChain<Input, cons.Concat<UPObjectStepSpec, ChainSteps, AddSteps>>
}

////////////////////////////////// recursion support ////////////////////

// idea is that a chain will have an associated service, and we use the 
// Tag<Input> of the chain to identify the service in a Context.Tag ... 
// then we can create an FxFn using the Context.Tag which can be used
// as a computation step to recurse or run any other chain as a computation
// step

// make an ObjectChainService impl with given which will run an ObjectChain 
// for a particular Input, and is identified by chain.contextTag
export function objectChainServiceImpl

    <Input extends ChainTagged,
        const Steps extends cons.NRConsList<UPObjectStepSpec>>

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
        const Steps extends cons.NRConsList<UPObjectStepSpec>,
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
        const Steps extends cons.NRConsList<UPObjectStepSpec>>

    (chain: ObjectChain<Input, Steps>) {

    return (i: Input) => {
        return Effect.gen(function* (_) {
            const svc = yield* _(chain.contextTag)
            const obj = yield* _(svc.buildObject(i))
            return obj
        })
    }
}
