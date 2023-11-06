// deno-lint-ignore-file no-explicit-any
import { Effect, Context } from "effect"

// inspiration:
// https://dev.to/ecyrbe/how-to-use-advanced-typescript-to-define-a-pipe-function-381h

// Service interfaces have 1 or more FxServiceFns which perform
// the effectful computations in a step
export interface FxServiceFn<D, R, E, V> {
    (d: D): Effect.Effect<R, E, V>
}

export type FxServiceTag<I, S> = Context.Tag<I, S>

// an ObjectStepSpec defines a single Effectful step towards building an Object.
// - f transforms an input A into the argument D of 
// the FxServiceFn, and the output of the FxServiceFn V will be added to the
// Object as {K: V}...
// an ObjectStepSpec can be used in different ways:
//
// - building an Object by chaining steps : each step 
//     augments the Object with {K: V} and the following step 
//     gets the Object-under-construction
// - building an Object by mapping steps independently over
//     a tuple of corresponding inputs - 
//     each step gets one value from the array of inputs and
//     its output V gets associated with the Object at K
export type ObjectStepSpec<K extends string, A, D, R, E, V> = {
    // the key at which the FxServiceFn output V will be added to the Object
    readonly k: K
    // a pure function which maps the input A to the FxServiceFn input D
    readonly f: (arg: A) => D
    // an effectful function of D, producing V
    readonly svcFn: FxServiceFn<D, R, E, V>
}

// build an Object by chaining an initial value through a sequence
// of steps, accumulating {K: V} after each step
export type ChainObjectSteps<Specs extends readonly [...any[]],
    ObjAcc,
    StepAcc extends [...any[]] = []> =

    // case: final spec - deliver final pipeline tuple type from StepAcc
    Specs extends [infer Head]
    ? Head extends ObjectStepSpec<infer K, infer _A, infer D, infer R, infer E, infer V>
    // return the final inferred pipeline
    ? readonly [...StepAcc, ObjectStepSpec<K, ObjAcc, D, R, E, V>]
    : ["ChainObjectStepsFail", "final-A: Head extends ObjectStepSpec", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends [infer Head, ...infer Tail]
    ? Head extends ObjectStepSpec<infer HK, infer _HA, infer HD, infer HR, infer HE, infer HV>
    ? Tail extends [infer Next, ...any]
    ? Next extends ObjectStepSpec<infer _NK, infer _NA, infer _ND, infer _NR, infer _NE, infer _NV>
    // recurse
    ? ChainObjectSteps<Tail,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, ObjectStepSpec<HK, ObjAcc, HD, HR, HE, HV>]>
    : ["ChainObjectStepsFail", "recurse-E: Next extends ObjectStepSpec", Specs]
    : ["ChainObjectStepsFail", "recurse-D: Tail extends [infer Next, ...any]", Specs]
    : ["ChainObjectStepsFail", "recurse-B: Head extends ObjectStepSpec", Specs]
    : ["ChainObjectStepsFail", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]

// builds a new Object type from an intersected ObjAcc type,
// making the intellisense much cleaner
// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// get the final Object result type from a list of ObjectStepSpecs
export type ChainObjectStepsReturn<Specs extends readonly [...any[]], ObjAcc> =
    ChainObjectSteps<Specs, ObjAcc> extends readonly [...infer _Prev, infer Last]
    ? Last extends ObjectStepSpec<infer LK, infer LA, infer _LD, infer _LR, infer _LE, infer LV>
    // final Object type adds the final step output to the final step input type
    ? Expand<LA & { [K in LK]: LV }>
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

// build an Object by independently mapping each Step over corresponding values in an Inputs tuple,
// accumulating outputs in an Object {K: V}
export type TupleMapObjectSteps<Specs extends readonly [...any[]],
    Inputs extends readonly [...any[]],
    StepAcc extends [...any[]] = []> =

    // case: final spec - deliver final pipeline tuple type from StepAcc
    Specs extends [infer Head]
    ? Inputs extends [infer HeadIn]
    ? Head extends ObjectStepSpec<infer K, HeadIn, infer D, infer R, infer E, infer V>
    // return the final inferred pipeline
    ? readonly [...StepAcc, ObjectStepSpec<K, HeadIn, D, R, E, V>]
    : ["TupleMapObjectSteps", "final-B: Head extends ObjectStepSpec", Specs]
    : ["TupleMapObjectSteps", "final-A: Inputs extends [infer HeadIn]", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends [infer Head, ...infer Tail]
    ? Inputs extends [infer HeadIn, ...infer TailIn]
    ? Head extends ObjectStepSpec<infer HK, HeadIn, infer HD, infer HR, infer HE, infer HV>
    ? Tail extends [infer Next, ...any]
    ? TailIn extends [infer NextIn, ...any]
    ? Next extends ObjectStepSpec<infer _NK, NextIn, infer _ND, infer _NR, infer _NE, infer _NV>
    // recurse
    ? TupleMapObjectSteps<Tail,
        TailIn,
        [...StepAcc, ObjectStepSpec<HK, HeadIn, HD, HR, HE, HV>]>
    : ["TupleMapObjectSteps", "recurse-G: Next extends ObjectStepSpec", Specs]
    : ["TupleMapObjectSteps", "recurse-F: TailIn extends [infer NextIn, ...any]", Specs]
    : ["TupleMapObjectSteps", "recurse-E: Tail extends [infer Next, ...any]", Specs]
    : ["TupleMapObjectSteps", "recurse-C: Head extends ObjectStepSpec", Specs]
    : ["TupleMapObjectSteps", "recurse-B: Inputs extends [infer HeadIn, ...infer TailIn]", Specs]
    : ["TupleMapObjectSteps", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]

// calculate the return type ... since the array type is not chained through
// the calculation, calculating the return type looks very similar to checking
// the step constraints, but we accumulate the return type rather than the 
// inferred steps
export type TupleMapObjectStepsReturn<Specs extends readonly [...any[]],
    Inputs extends readonly [...any[]],
    // the lint recommendation messes up the return type here, so ignoring it
    // deno-lint-ignore ban-types
    ObjAcc = {},
    StepAcc extends [...any[]] = []> =

    // case: final spec - return type 
    Specs extends [infer Head]
    ? Inputs extends [infer HeadIn]
    ? Head extends ObjectStepSpec<infer K, HeadIn, infer _D, infer _R, infer _E, infer V>
    // return the final inferred pipeline
    ? Expand<ObjAcc & { [KK in K]: V }>
    : ["TupleMapObjectStepsReturn", "final-B: Head extends ObjectStepSpec", Specs]
    : ["TupleMapObjectStepsReturn", "final-A: Inputs extends [infer HeadIn]", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends [infer Head, ...infer Tail]
    ? Inputs extends [infer HeadIn, ...infer TailIn]
    ? Head extends ObjectStepSpec<infer HK, HeadIn, infer HD, infer HR, infer HE, infer HV>
    ? Tail extends [infer Next, ...any]
    ? TailIn extends [infer NextIn, ...any]
    ? Next extends ObjectStepSpec<infer _NK, NextIn, infer _ND, infer _NR, infer _NE, infer _NV>
    // recurse
    ? TupleMapObjectStepsReturn<Tail,
        TailIn,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, ObjectStepSpec<HK, HeadIn, HD, HR, HE, HV>]>
    : ["TupleMapObjectStepsReturn", "recurse-G: Next extends ObjectStepSpec", Specs]
    : ["TupleMapObjectStepsReturn", "recurse-F: TailIn extends [infer NextIn, ...any]", Specs]
    : ["TupleMapObjectStepsReturn", "recurse-E: Tail extends [infer Next, ...any]", Specs]
    : ["TupleMapObjectStepsReturn", "recurse-C: Head extends ObjectStepSpec", Specs]
    : ["TupleMapObjectStepsReturn", "recurse-B: Inputs extends [infer HeadIn, ...infer TailIn]", Specs]
    : ["TupleMapObjectStepsReturn", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]

// once again, want to provide the Inputs type, but infer the ObjectStepSpecs type,
// so we have to curry
export declare function tupleMapObjectStepsProg<Inputs extends readonly [...any[]]>():
    <ObjectStepSpecs extends readonly [...any[]]>

        (_ObjectStepSpecs: TupleMapObjectSteps<ObjectStepSpecs, Inputs> extends readonly [...ObjectStepSpecs]
            ? readonly [...ObjectStepSpecs]
            : TupleMapObjectSteps<ObjectStepSpecs, Inputs>)

        => (inputs: Inputs) => Effect.Effect<never, never, TupleMapObjectStepsReturn<ObjectStepSpecs, Inputs>>

//////////////////////////////////////////////////////////////////////////////

// demonstrating...

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
export const getOrgByNick: FxServiceFn<string, OrgService, never, Org> = (org_nick: string) => {
    return Effect.gen(function* (_) {
        const svc = yield* _(OrgService)
        const org = yield* _(svc.getByNick(org_nick))
        return org
    })
}

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
export const getUserByIds: FxServiceFn<{ org_id: string, user_id: string }, UserService, never, User> = (d: { org_id: string, user_id: string }) => {
    return Effect.gen(function* (_) {
        const svc = yield* _(UserService)
        const user = yield* _(svc.getByIds(d))
        return user
    })
}

// then some computation steps...

// as const is required to prevent the k from being widened to a string type
// and to ensure the specs array is interpreted as a tuple
const getOrgObjectStepSpec /* : ObjectStepSpec<"org", { data: { org_nick: string } }, string, OrgService, never, Org> */ =
{
    k: "org" as const,
    f: (d: { data: { org_nick: string } }) => d.data.org_nick,
    svcFn: getOrgByNick
}
const getUserObjectStepSpec /* : ObjectStepSpec<"user", { data: { user_id: string }, org: Org }, {org_id: string, user_id: string}, UserService, never, User> */ =
{
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    f: (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } },
    svcFn: getUserByIds
}
export const stepSpecs = [
    getOrgObjectStepSpec,
    getUserObjectStepSpec
] as const

// and finally, the object builder programs... 

// a program to build an Object by chaining the accumulating Object through the steps
//
// $ExpectType const chainProg: (arg: {
//     data: {
//         org_nick: string;
//         user_id: string;
//     };
// }) => Effect.Effect<never, never, {
//     data: {
//         org_nick: string;
//         user_id: string;
//     };
//     org: Org;
//     user: User;
// }>
export const chainProg = chainObjectStepsProg<{ data: { org_nick: string, user_id: string } }>()(stepSpecs)

// a program to build an Object by mapping each step over it's corresponding input value
//
// $ExpectType const tupleProg: (inputs: [{
//     data: {
//         org_nick: string;
//     };
// }, {
//     data: {
//         user_id: string;
//     };
//     org: Org;
// }]) => Effect.Effect<never, never, {
//     org: Org;
//     user: User;
// }>
export const tupleProg = tupleMapObjectStepsProg<[{ data: { org_nick: string } }, { data: { user_id: string }, org: Org }]>()(stepSpecs)

