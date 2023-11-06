// deno-lint-ignore-file no-explicit-any
import { Effect, Context } from "effect"

// inspiration:
// https://dev.to/ecyrbe/how-to-use-advanced-typescript-to-define-a-pipe-function-381h

// each ObjectStepSpec step defines:
// - a key, k:
// - a tag, svc:, for an FxService interface
// - a key, svcFn:, for an FxServiceFn on the FxService
// - a fn, f:,  which takes the output map of the previous step and
//   returns the input type of the FxServiceFn
// 
// an ObjectStepSpec can be used in a different ways
// - building an Object by chaining steps : each step 
//     augments the Object with {K: V} and the following step 
//     gets the map-under-construction
// - building an Object by running steps on an array of inputs
//     each step gets one value from the array of inputs and
//     its output gets associated with the Object at K

// an FxService interface will have 1 or more FxService fns
export interface FxServiceFn<D, R, E, V> {
    (d: D): Effect.Effect<R, E, V>
}

export type FxServiceTag<I, S> = Context.Tag<I, S>

// data defining a single Effectful step towards building an Object.
// f transforms the Object-so-far:A into the argument D of 
// the service function F on service interface S,
// and the output of the service function will then be added to the Object-so-far
// at {K: V}... the service function F and its output V must be 
// inferred, since there any many service functions per service interface S, 
// so the type can't be parameterised
export type ObjectStepSpec<K extends string, A, D, I, S, FK extends keyof S> =
    {
        // the key at which the service output will be added to the pipeline accumulator object A
        readonly k: K
        // a pure function which maps the accumulator to the service input D
        readonly f: (arg: A) => D
        // a service interface and the key of a service fn
        readonly svc: FxServiceTag<I, S>
        readonly svcFn: FK
    }

// build an Object by chaining an initial value through a sequence
// of steps, accumulating {K: V} after each step
export type ChainObjectSteps<Specs extends readonly [...any[]],
    ObjAcc,
    StepAcc extends [...any[]] = []> =

    // case: final spec - deliver final pipeline tuple type from StepAcc
    Specs extends [infer Head]
    ? Head extends ObjectStepSpec<infer K, infer _A, infer D, infer I, infer S, infer FK>
    ? S[FK] extends FxServiceFn<D, infer _R, infer _E, infer _V>
    // return the final inferred pipeline
    ? readonly [...StepAcc, ObjectStepSpec<K, ObjAcc, D, I, S, FK>]
    : ["ChainObjectStepsFail", "final-B: S[FK] extends FxServiceFn", Specs]
    : ["ChainObjectStepsFail", "final-A: Head extends ObjectStepSpec", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends [infer Head, ...infer Tail]
    ? Head extends ObjectStepSpec<infer HK, infer _HA, infer HD, infer HI, infer HS, infer HFK>
    ? HS[HFK] extends FxServiceFn<HD, infer _HR, infer _HE, infer HV>
    ? Tail extends [infer Next, ...any]
    ? Next extends ObjectStepSpec<infer _NK, infer _NA, infer ND, infer _NI, infer NS, infer NFK>
    ? NS[NFK] extends FxServiceFn<ND, infer _NR, infer _NE, infer _NV>
    // recurse
    ? ChainObjectSteps<Tail,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, ObjectStepSpec<HK, ObjAcc, HD, HI, HS, HFK>]>
    : ["ChainObjectStepsFail", "recurse-F: NS[NFK] extends FxServiceFn ", Specs]
    : ["ChainObjectStepsFail", "recurse-E: Next extends ObjectStepSpec", Specs]
    : ["ChainObjectStepsFail", "recurse-D: Tail extends [infer Next, ...any]", Specs]
    : ["ChainObjectStepsFail", "recurse-C: HS[HFK] extends FxServiceFn", Specs]
    : ["ChainObjectStepsFail", "recurse-B: Head extends ObjectStepSpec", Specs]
    : ["ChainObjectStepsFail", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]

// builds a new Object type from an intersected ObjAcc type,
// which makes the intellisense much nicer
// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// get the final Object result type from a list of ObjectStepSpecs
export type ChainObjectStepsReturn<Specs extends readonly [...any[]], ObjAcc> =
    ChainObjectSteps<Specs, ObjAcc> extends readonly [...infer _Prev, infer Last]
    ? Last extends ObjectStepSpec<infer LK, infer LA, infer LD, infer _LI, infer LS, infer LFK>
    ? LS[LFK] extends FxServiceFn<LD, infer _LR, infer _LE, infer LV>
    // final Object type adds the final step output to the final step input type
    ? Expand<LA & { [K in LK]: LV }>
    : ["ChainObjectStepsReturnFail", "C-LS[LFK] extends FxServiceFn", ChainObjectSteps<Specs, ObjAcc>]
    : ["ChainObjectStepsReturnFail", "B-Last extends ObjectStepSpec", ChainObjectSteps<Specs, ObjAcc>]
    : ["ChainObjectStepsReturnFail", "A-ChainObjectSteps<Specs, ObjAcc> extends", ChainObjectSteps<Specs, ObjAcc>]

// since we want to pass an initial Data type param, but to infer 
// ObjectStepSpecs - and typescript inference is all-or-nothing, we must curry
// https://effectivetypescript.com/2020/12/04/gentips-1-curry/
export declare function chainObjectStepsProg<Init>():
    <ObjectStepSpecs extends readonly [...any[]]>

        // and this trick allows the ObjectStepSpecs param to be typed as
        //   readonly[...ObjectStepSpecs]
        // while also applying the ChainObjectSteps type checks
        (_ObjectStepSpecs: ChainObjectSteps<ObjectStepSpecs, Init> extends readonly [...ObjectStepSpecs]
            ? readonly [...ObjectStepSpecs]
            : ChainObjectSteps<ObjectStepSpecs, Init>)

        => (arg: Init) => Effect.Effect<never, never, ChainObjectStepsReturn<ObjectStepSpecs, Init>>

//////////////////////////////////////////////////////////////////////////////

// build an Object by independently mapping each step over corresponding values in an array,
// accumulating all outputs at {K: V}
export type ArrayMapObjectSteps<Specs extends readonly [...any[]],
    Inputs extends readonly [...any[]],
    StepAcc extends [...any[]] = []> =

    // case: final spec - deliver final pipeline tuple type from StepAcc
    Specs extends [infer Head]
    ? Inputs extends [infer HeadIn]
    ? Head extends ObjectStepSpec<infer K, HeadIn, infer D, infer I, infer S, infer FK>
    ? S[FK] extends FxServiceFn<D, infer _R, infer _E, infer _V>
    // return the final inferred pipeline
    ? readonly [...StepAcc, ObjectStepSpec<K, HeadIn, D, I, S, FK>]
    : ["ArrayMapObjectSteps", "final-C: S[FK] extends FxServiceFn<", Specs]
    : ["ArrayMapObjectSteps", "final-B: Head extends ObjectStepSpec", Specs]
    : ["ArrayMapObjectSteps", "final-A: Inputs extends [infer HeadIn]", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends [infer Head, ...infer Tail]
    ? Inputs extends [infer HeadIn, ...infer TailIn]
    ? Head extends ObjectStepSpec<infer HK, HeadIn, infer HD, infer HI, infer HS, infer HFK>
    ? HS[HFK] extends FxServiceFn<HD, infer _HR, infer _HE, infer HV>
    ? Tail extends [infer Next, ...any]
    ? TailIn extends [infer NextIn, ...any]
    ? Next extends ObjectStepSpec<infer _NK, NextIn, infer ND, infer _NI, infer NS, infer NFK>
    ? NS[NFK] extends FxServiceFn<ND, infer _NR, infer _NE, infer _NV>
    // recurse
    ? ChainObjectSteps<Tail,
        [...StepAcc, ObjectStepSpec<HK, HeadIn, HD, HI, HS, HFK>]>
    : ["ArrayMapObjectSteps", "recurse-H: NS[NFK] extends FxServiceFn ", Specs]
    : ["ArrayMapObjectSteps", "recurse-G: Next extends ObjectStepSpec", Specs]
    : ["ArrayMapObjectSteps", "recurse-F: TailIn extends [infer NextIn, ...any]", Specs]
    : ["ArrayMapObjectSteps", "recurse-E: Tail extends [infer Next, ...any]", Specs]
    : ["ArrayMapObjectSteps", "recurse-D: HS[HFK] extends FxServiceFn", Specs]
    : ["ArrayMapObjectSteps", "recurse-C: Head extends ObjectStepSpec", Specs]
    : ["ArrayMapObjectSteps", "recurse-B: Inputs extends [infer HeadIn, ...infer TailIn]", Specs]
    : ["ArrayMapObjectSteps", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]

// calculate the return type ... since the array type is not chained through
// the calculation, calculating the return type looks very similar to checking
// the step constraints, but we accumulate the return type rather than the 
// inferred steps
export type ArrayMapObjectStepsReturn<Specs extends readonly [...any[]],
    Inputs extends readonly [...any[]],
    ObjAcc = Record<string | number | symbol, never>,
    StepAcc extends [...any[]] = []> =

    // case: final spec - return type 
    Specs extends [infer Head]
    ? Inputs extends [infer HeadIn]
    ? Head extends ObjectStepSpec<infer K, HeadIn, infer D, infer _I, infer S, infer FK>
    ? S[FK] extends FxServiceFn<D, infer _R, infer _E, infer V>
    // return the final inferred pipeline
    ? ObjAcc & { [KK in K]: V }
    : ["ArrayMapObjectStepsReturn", "final-C: S[FK] extends FxServiceFn", Specs]
    : ["ArrayMapObjectStepsReturn", "final-B: Head extends ObjectStepSpec", Specs]
    : ["ArrayMapObjectStepsReturn", "final-A: Inputs extends [infer HeadIn]", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends [infer Head, ...infer Tail]
    ? Inputs extends [infer HeadIn, ...infer TailIn]
    ? Head extends ObjectStepSpec<infer HK, HeadIn, infer HD, infer HI, infer HS, infer HFK>
    ? HS[HFK] extends FxServiceFn<HD, infer _HR, infer _HE, infer HV>
    ? Tail extends [infer Next, ...any]
    ? TailIn extends [infer NextIn, ...any]
    ? Next extends ObjectStepSpec<infer _NK, NextIn, infer ND, infer _NI, infer NS, infer NFK>
    ? NS[NFK] extends FxServiceFn<ND, infer _NR, infer _NE, infer _NV>
    // recurse
    ? ArrayMapObjectStepsReturn<Tail,
        Inputs,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, ObjectStepSpec<HK, HeadIn, HD, HI, HS, HFK>]>
    : ["ArrayMapObjectStepsReturn", "recurse-H: NS[NFK] extends FxServiceFn ", Specs]
    : ["ArrayMapObjectStepsReturn", "recurse-G: Next extends ObjectStepSpec", Specs]
    : ["ArrayMapObjectStepsReturn", "recurse-F: TailIn extends [infer NextIn, ...any]", Specs]
    : ["ArrayMapObjectStepsReturn", "recurse-E: Tail extends [infer Next, ...any]", Specs]
    : ["ArrayMapObjectStepsReturn", "recurse-D: HS[HFK] extends FxServiceFn", Specs]
    : ["ArrayMapObjectStepsReturn", "recurse-C: Head extends ObjectStepSpec", Specs]
    : ["ArrayMapObjectStepsReturn", "recurse-B: Inputs extends [infer HeadIn, ...infer TailIn]", Specs]
    : ["ArrayMapObjectStepsReturn", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]
        
// once again, want to provide the Inputs type, but infer the ObjectStepSpecs type,
// so we have to curry
export declare function arrayMapObjectStepsProg<Inputs extends readonly [...any[]]>():
    <ObjectStepSpecs extends readonly [...any[]]>

        (_ObjectStepSpecs: ArrayMapObjectSteps<ObjectStepSpecs, Inputs> extends readonly [...ObjectStepSpecs]
            ? readonly [...ObjectStepSpecs]
            : ArrayMapObjectSteps<ObjectStepSpecs, Inputs>)

        => (inputs: Inputs) => Effect.Effect<never, never, ArrayMapObjectStepsReturn<ObjectStepSpecs, Inputs>>

//////////////////////////////////////////////////////////////////////////////

// now to demonstrate...

// first some services for an Org and User...

export type Org = {
    id: string
    name: string
}
interface OrgService { readonly _: unique symbol }
export interface OrgServiceI {
    readonly getById: (id: string) => Effect.Effect<never, never, Org>
    readonly getByNick: (nick: string) => Effect.Effect<never, never, Org>
}
export const OrgService = Context.Tag<OrgService, OrgServiceI>("OrgService")

export type User = {
    id: string
    name: string
}
interface UserService { readonly _: unique symbol }
// the service interface
export interface UserServiceI {
    readonly getByIds: (d: { org_id: string, user_id: string }) => Effect.Effect<never, never, User>
}
export const UserService = Context.Tag<UserService, UserServiceI>("UserService")

// then some computation steps...

// as const is required to prevent the k from being widened to a string type
// and to ensure the specs array is interpreted as a tuple
const getOrgObjectStepSpec =
{
    k: "org" as const,
    f: (d: { data: { org_nick: string } }) => d.data.org_nick,
    svc: OrgService,
    svcFn: "getByNick" as const
}
const getUserObjectStepSpec =
{
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    f: (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } },
    svc: UserService,
    svcFn: "getByIds" as const
}
export const specs = [
    getOrgObjectStepSpec,
    getUserObjectStepSpec
] as const

// and finally, to the object pipeline program... defines the type of the required
// input to the chain, and the computation steps to build the object. 
// each step's f and serviceFn is checked against the accumulated object from the previous steps

export const prog = chainObjectStepsProg<{ data: { org_nick: string, user_id: string } }>()(specs)

// consider ... error messages from inference are a bit weird ... if the transform could add in 
// the type of the service fns somehow then that might help - but the service fns are
// not currently in the ObjectStepSpec type except via indirection through the service interface...
// maybe we can add the service-fn type as a type-param to the ObjectStepSpec ?

// next - this effectfulObjectChain can generate pure-fn inputs - for the outputs we might
// want to have a similar chain specification, but feed each of the pure-fn outputs [] 
// separately to a [key effectfulStep] - since the effects are likely independent
// but it would still be nice to build an object to use as a return value (objects
// being generally much nicer to consume than tuples because the keys give away semantics)