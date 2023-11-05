// deno-lint-ignore-file no-explicit-any
import { Effect, Context } from "effect"

// inspiration:
// https://dev.to/ecyrbe/how-to-use-advanced-typescript-to-define-a-pipe-function-381h

// each Effectful step defines:
// - a key
// - a tag for an FxService interface
// - a key for an FxServiceFn on the FxService
// - a fn which takes the output map of the previous step and
//   returns the input type of the FxServiceFn
// 
// - and the output of the step is a new map type combining the inmap
//   with the new key and output value from the FxServiceFn Effect

// an FxService interface will have 1 or more FxService fns
export interface FxServiceFn<D, R, E, V> {
    (d: D): Effect.Effect<R, E, V>
}

export type FxServiceTag<I, S> = Context.Tag<I, S>

// data defining a single Effectful step towards building an Object.
// f transforms the Object-so-far:A into the argument D of 
// the service function F on service interface S,
// and the output of the service function will then be added to the Object-so-far
// at {K: V}
export type StepSpec<K extends string, A, D, I, S, FK extends keyof S> =
    {
        // the key at which the service output will be added to the pipeline accumulator object A
        readonly k: K
        // a pure function which maps the accumulator to the service input D
        readonly f: (arg: A) => D
        // a service interface and the key of a service fn
        readonly svc: FxServiceTag<I, S>
        readonly svcFn: FK
    }

// recursively infer a tuple-type for an Effectful Object builder pipeline
// from a tuple of StepSpecs, building up the Obj type along the way
export type ObjectPipeline<Specs extends readonly [...any[]],
    ObjAcc,
    StepAcc extends [...any[]] = []> =

    // case: final spec - deliver final pipeline tuple type from StepAcc
    Specs extends [infer Head]
    ? Head extends StepSpec<infer K, infer _A, infer D, infer I, infer S, infer FK>
    ? S[FK] extends FxServiceFn<D, infer _R, infer _E, infer _V>
    // return the final inferred pipeline
    ? readonly [...StepAcc, StepSpec<K, ObjAcc, D, I, S, FK>]
    : ["ObjectPipelineFail", "B-final: Head extends StepSpec", Specs]
    : ["ObjectPipelineFail", "A-final: Specs extends [infer Head]", Specs] 

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends [infer Head, ...infer Tail]
    ? Head extends StepSpec<infer HK, infer _HA, infer HD, infer HI, infer HS, infer HFK>
    ? HS[HFK] extends FxServiceFn<HD, infer _HR, infer _HE, infer HV>
    ? Tail extends [infer Next, ...any]
    ? Next extends StepSpec<infer _NK, infer _NA, infer ND, infer _NI, infer NS, infer NFK>
    ? NS[NFK] extends FxServiceFn<ND, infer _NR, infer _NE, infer _NV>
    // recurse
    ? ObjectPipeline<Tail,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, StepSpec<HK, ObjAcc, HD, HI, HS, HFK>]>
    : ["ObjectPipelineFail", "H-recurse: NS[NFK] extends FxServiceFn ", Specs]   
    : ["ObjectPipelineFail", "G-recurse: Next extends StepSpec", Specs] 
    : ["ObjectPipelineFail", "F-recurse: Tail extends [infer Next, ...any]", Specs] 
    : ["ObjectPipelineFail", "E-recurse: HS[HFK] extends FxServiceFn", Specs] 
    : ["ObjectPipelineFail", "D-recurse: Head extends StepSpec", Specs] 
    : ["ObjectPipelineFail", "C-recurse: Specs extends [infer Head, ...infer Tail]", Specs]

// builds a new Object type from an intersected ObjAcc type,
// which makes the intellisense much simpler
// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// get the final Object type from a list of StepSpecs
export type FinalObjectType<Specs extends readonly [...any[]], ObjAcc> =
    ObjectPipeline<Specs, ObjAcc> extends readonly [...infer _Prev, infer Last]
    ? Last extends StepSpec<infer LK, infer LA, infer LD, infer _LI, infer LS, infer LFK>
    ? LS[LFK] extends FxServiceFn<LD, infer _LR, infer _LE, infer LV>
    // final Object type adds the final step output to the final step input type
    ? Expand<LA & { [K in LK]: LV }>
    : ["FinalObjectTypeFail", "C-LS[LFK] extends FxServiceFn", ObjectPipeline<Specs, ObjAcc>]
    : ["FinalObjectTypeFail", "B-Last extends StepSpec", ObjectPipeline<Specs, ObjAcc>]
    : ["FinalObjectTypeFail", "A-ObjectPipeline<Specs, ObjAcc> extends", ObjectPipeline<Specs, ObjAcc>]

// since we want to pass an initial Data type param, but to infer 
// StepSpecs - and typescript inference is all-or-nothing, we must curry
// https://effectivetypescript.com/2020/12/04/gentips-1-curry/
export declare function buildObjectPipelineProg<Init>():
    <StepSpecs extends readonly [...any[]]>

        // and this trick allows the StepSpecs param to be typed as
        //   readonly[...StepSpecs]
        // while also applying the ObjectPipeline type checks
        (_stepSpecs: ObjectPipeline<StepSpecs, Init> extends readonly [...StepSpecs] ? readonly [...StepSpecs] : ObjectPipeline<StepSpecs, Init>)

        => (arg: Init) => Effect.Effect<never, never, FinalObjectType<StepSpecs, Init>>

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
const getOrgStepSpec =
{
    k: "org" as const,
    f: (d: { data: { org_nick: string } }) => d.data.org_nick,
    svc: OrgService,
    svcFn: "getByNick" as const
}
const getUserStepSpec =
{
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    f: (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } },
    svc: UserService,
    svcFn: "getByIds" as const
}
export const specs = [
    getOrgStepSpec,
    getUserStepSpec
] as const

// and finally, to the object pipeline program... defines the type of the required
// input to the chain, and the computation steps to build the object. 
// each step's f and serviceFn is checked against the accumulated object from the previous steps

export const prog = buildObjectPipelineProg<{ data: { org_nick: string, user_id: string } }>()(specs)

// consider ... error messages from inference are a bit weird ... if the transform could add in 
// the type of the service fns somehow then that might help - but the service fns are
// not currently in the StepSpec type except via indirection through the service interface...
// maybe we can add the service-fn type as a type-param to the StepSpec ?

// next - this effectfulObjectChain can generate pure-fn inputs - for the outputs we might
// want to have a similar chain specification, but feed each of the pure-fn outputs [] 
// separately to a [key effectfulStep] - since the effects are likely independent
// but it would still be nice to build an object to use as a return value (objects
// being generally much nicer to consume than tuples because the keys give away semantics)