// deno-lint-ignore-file no-explicit-any
import { Effect, Context } from "effect"

// reference:
// https://dev.to/ecyrbe/how-to-use-advanced-typescript-to-define-a-pipe-function-381h

// each Effectful step defines:
// - a key
// - a tag for an FxService
// - a fn which takes the output map of the previous step and
//   returns the input type of the service
// 
// - and the output of the step is a new map type combining the inmap
//   with the new key and output value from the service

// an Effectful Service interface which takes a single argument
export interface FxService<R, E, D, V> {
    readonly fx: {
        (arg: D): Effect.Effect<R, E, V>
    }
}
export type FxServiceTag<R, E, D, V> = Context.Tag<any, FxService<R, E, D, V>>

// data defining a single Effectful step towards building an Object.
// f transforms the Object-so-far:A into the FxService argument D,
// and the output of the FxService will then be added to the Object-so-far
// at {K: V}
export type StepSpec<R, E, D, V, K extends string, A> = {
    // the key at which the service output will be added to the pipeline accumulator object A
    readonly k: K
    // a pure function which maps the accumulator to the service input D
    readonly f: (arg: A) => D
    // a service requiring data D to produce value V
    readonly svc: FxServiceTag<R, E, D, V>
}

// extract the FxServiceTag from a StepSpec
export type ExtractFxServiceTag<T> = T extends StepSpec<infer _R, infer _E, infer _D, infer _V, infer _K, infer _A>
    ? T["svc"]
    : never

// extract the value type from a StepSpec
export type ExtractValueType<T> = ExtractFxServiceTag<T> extends FxServiceTag<infer _R, infer _E, infer _D, infer V> ? V : never

// recursively infer a tuple-type for an Effectful Object builder pipeline
// from a tuple of StepSpecs, building up the Obj type along the way
export type ObjectPipeline<Specs extends readonly [...any[]],
    ObjAcc,
    StepAcc extends [...any[]] = []> =

    // case: final spec - deliver final pipeline tuple type from StepAcc
    Specs extends [StepSpec<infer R, infer E, infer D, infer V, infer K, infer _A>]
    ? readonly [...StepAcc, StepSpec<R, E, D, V, K, ObjAcc>]

    // case: there are more specs - add to StepAcc and ObjAcc and recurse
    : Specs extends [infer Head, ...infer Tail]
    ? Head extends StepSpec<infer HR, infer HE, infer HD, infer HV, infer HK, infer _HA>
    ? Tail extends [StepSpec<infer _NR, infer _NE, infer _ND, infer _NV, infer _NK, infer _NA>, ...any]
    ? ObjectPipeline<Tail,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, StepSpec<HR, HE, HD, HV, HK, ObjAcc>]>
    : ["ObjectPipelineFail", "C", Specs] // Tail
    : ["ObjectPipelineFail", "B", Specs] // Head
    : ["ObjectPipelineFail", "A", Specs] // Specs

// builds a new Object type from an intersected ObjAcc type,
// which makes the intellisense much simpler
// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// get the final Object type from a list of StepSpecs
export type FinalObjectType<Specs extends readonly [...any[]], Init> =
    ObjectPipeline<Specs, Init> extends readonly [...infer _Prev, infer Last]
    ? Last extends StepSpec<infer _LR, infer _LE, infer _LD, infer LV, infer LK, infer LA>
    ? Expand<LA & { [K in LK]: LV }>
    : ["FinalObjectTypeFail", "B", ObjectPipeline<Specs, Init>] // Last
    : ["FinalObjectTypeFail", "A", ObjectPipeline<Specs, Init>] // ObjectPipeline

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

// first some services...

export type Org = {
    id: string
    name: string
}
interface GetOrgService { readonly _: unique symbol }
export interface GetOrgServiceI extends FxService<never, never, string, Org> {
    readonly fx: (nick: string) => Effect.Effect<never, never, Org>
}
export const GetOrgService = Context.Tag<GetOrgService, GetOrgServiceI>("GetOrgService")

export type User = {
    id: string
    name: string
}
interface GetUserService { readonly _: unique symbol }
// the service interface
export interface GetUserServiceI extends FxService<never, never, { org_id: string, user_id: string }, User> {
    readonly fx: (d: { org_id: string, user_id: string }) => Effect.Effect<never, never, User>
}
export const GetUserService = Context.Tag<GetUserService, GetUserServiceI>("GetUserService")

// then some computation steps...

// as const is required to prevent the k from being widened to a string type
// and to ensure the specs array is interpreted as a tuple
const getOrgStepSpec =
{
    k: "org" as const,
    svc: GetOrgService,
    f: (d: { data: { org_nick: string } }) => d.data.org_nick
}
const getUserStepSpec =
{
    k: "user" as const,
    svc: GetUserService,
    // note that this fn depends on the output of a getOrgStep
    f: (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } }
}
export const specs = [
    getOrgStepSpec,
    getUserStepSpec
] as const

// and finally, to the object pipeline program... 
// each step's f is checked against the accumulated object from the previous steps

export const prog = buildObjectPipelineProg<{ data: { org_nick: string, user_id: string } }>()(specs)
