import { Effect } from "effect"
import { FxFn, UPFxFn } from "./fx_fn.ts"
import { None, NRConsList, Last, ToTuple, toTuple} from "./cons_list.ts"

// inspiration:
// https://dev.to/ecyrbe/how-to-use-advanced-typescript-to-define-a-pipe-function-381h

// an ObjectStepSpec defines a single step towards building an Object.
// 
// each step takes the Object as a parameter A, and returns an additional
// key K with value V
//
// pure steps use a single pureFn while effectful steps use a 
// pure inFn to extract an argument for an FxFn

////////////////// Parameterised and Constrained steps ///////////////////////

// these are the natural steps, but are awkward to work with 
// when using conditional types over arrays

export type FxObjectStepSpec<K extends string, A, D, R, E, V> = {
    // the key at which the FxFn output V will be added to the Object
    readonly k: K
    // a pure function which maps the input A to the FxFn input D
    readonly inFn: (arg: A) => D
    // an effectful function of D, producing V
    readonly fxFn: FxFn<D, R, E, V>
}

// a pure step
export type PureObjectStepSpec<K extends string, A, V> = {
    readonly k: K
    readonly pureFn: (arg: A) => V
}

export type ObjectStepSpec<K extends string, A, D, R, E, V>
    = PureObjectStepSpec<K, A, V> | FxObjectStepSpec<K, A, D, R, E, V>

////////////////////// UnConstrained steps ///////////////////////////

// UnConstrained steps allow for guaranteed-successful conditional 
// inference from an array of the UnParameterised steps

export type UCFxObjectStepSpec<K extends string, A, D1, D2, R, E, V> = {
    // the key at which the FxFn output V will be added to the Object
    readonly k: K
    // a pure function which maps the input A to the FxFn input D
    readonly inFn: (arg: A) => D1
    // an effectful function of D, producing V
    readonly fxFn: FxFn<D2, R, E, V>
}

export type UCPureObjectStepSpec<K extends string, A, V> =
    PureObjectStepSpec<K, A, V>

export type UCObjectStepSpec<K extends string, A, D1, D2, R, E, V> =
    UCPureObjectStepSpec<K, A, V> | UCFxObjectStepSpec<K, A, D1, D2, R, E, V>

////////////////////// UnParameterised steps ///////////////////////////

// UnParameterised steps can be used to roughly type lists of steps, 
// and we can guarantee that the conditional inferences on the 
// UnParameterised types will always reach a non-never leaf node,
// which may then deliver a sensible error to the user

export type UPFxObjectStepSpec = {
    // the key at which the FxFn output V will be added to the Object
    readonly k: string
    // a pure function which maps the input A to the FxFn input D
    // deno-lint-ignore no-explicit-any
    readonly inFn: (arg: any) => any
    // an effectful function of D, producing V
    readonly fxFn: UPFxFn
}

export type UPPureObjectStepSpec = {
    readonly k: string
    // deno-lint-ignore no-explicit-any
    readonly pureFn: (arg: any) => any
}

// the unparameterised type we will type all step tuples with
export type UPObjectStepSpec = UPPureObjectStepSpec | UPFxObjectStepSpec

// some casts to get the parameterised step types back from 
// the unparameterised versions

// cast an UPFxObjectStepSpec down to its fully parameterised type
export type CastUPFxObjectStepSpec<T extends UPFxObjectStepSpec> =
    T extends UCFxObjectStepSpec<infer K, infer A, infer D1, infer D2,
        infer R, infer E, infer V>
    ? UCFxObjectStepSpec<K, A, D1, D2, R, E, V>
    : never

// cast an UPPureObjectStepSpec down to its fully parameterised type
export type CastUPPureObjectStepSpec<T extends UPPureObjectStepSpec> =
    T extends UCPureObjectStepSpec<infer K, infer A, infer V>
    ? UCPureObjectStepSpec<K, A, V>
    : never

// cast an UPObjectStepSpec down to its fully parameterised type
export type CastObjectStepSpec<T extends UPObjectStepSpec> =
    T extends PureObjectStepSpec<infer K, infer A, infer V>
    ? PureObjectStepSpec<K, A, V>
    : T extends UCFxObjectStepSpec<
        infer K, infer A, infer _D1, infer D2, infer R, infer E, infer V>
    // also apply the D1==D2 constraint
    ? UCFxObjectStepSpec<K, A, D2, D2, R, E, V>
    : never

//////////////////////// step fn //////////////////////////////////////

// the effect returned when a step is run
export type ObjectStepFnReturnEffect<Spec> =
    Spec extends PureObjectStepSpec<infer K, infer _A, infer V>
    ? Effect.Effect<never, never, { readonly [_K in K]: V }>
    : Spec extends FxObjectStepSpec<
        infer K, infer _A, infer _D, infer R, infer E, infer V>
    ? Effect.Effect<R, E, { readonly [_K in K]: V }>
    : never

// returns a function of Obj which runs a single step, returning {K: V}
// exactly how that {K: V} is combined with Obj is left to the caller
export function objectStepFn<Obj>() {
    return function <Step extends UPObjectStepSpec>
        (step: CastObjectStepSpec<Step> extends Step
            ? Step : CastObjectStepSpec<Step>) {

        return function (obj: Obj) {

            console.log("CREATE OBJECT STEP FN", step.k, step)

            return Effect.gen(function* (_) {
                console.log("RUN OBJECT STEP FN", step.k, step, obj)

                const v = ("pureFn" in step) ? step.pureFn(obj)
                    : yield* _(step.fxFn(step.inFn(obj)))

                console.log("OBJECT STEP FN v", step.k, v)

                const r = { [step.k]: v }
                console.log("END OBJECT STEP FN r", step.k, r)
                return r
            }) as ObjectStepFnReturnEffect<Step>
        }
    }
}

// utility type to get a Union from a Tuple of types
// deno-lint-ignore no-explicit-any
export type UnionFromTuple<Tuple extends readonly any[]> = Tuple[number]

// builds a new Object type from an intersected ObjAcc type,
// making the intellisense much cleaner
// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type
export type Expand<T> = T extends infer O
    ? { readonly [K in keyof O]: O[K] }
    : never;

// deno-lint-ignore no-explicit-any
export type ExpandTuple<Tuple extends readonly [...any[]]> = {
    +readonly [Index in keyof Tuple]: Expand<Tuple[Index]>
} & { length: Tuple['length'] }

// convert a cons list of UPObjectStepSpecs type to a Tuple type
export type ObjectStepsTuple<Steps extends NRConsList<UPObjectStepSpec>> =
    ToTuple<UPObjectStepSpec, Steps>

// get a union of all the Requirements from a list of steps...
// note that only FxObjectSteps have any Requirements
export type ObjectStepReqs<T extends UPObjectStepSpec> =
    T extends UCFxObjectStepSpec<
        infer _K, infer _A, infer _D1, infer _D2, infer R, infer _E, infer _V>
    ? R
    : never
export type ObjectStepsReqsU<
    List extends NRConsList<UPObjectStepSpec>,
    Acc = never> = 
    List extends None
    ? Acc
    : List extends readonly [infer F extends UPObjectStepSpec,
        infer R extends NRConsList<UPObjectStepSpec>]
    ? ObjectStepsReqsU<R, Acc | ObjectStepReqs<F>>
    : never
type ObjectStepsTupleReqsUImpl<
    Tuple extends readonly [...UPObjectStepSpec[]]> =
    UnionFromTuple<{
        +readonly [Index in keyof Tuple]: ObjectStepReqs<Tuple[Index]>
    } & { length: Tuple['length'] }>
// tuple version ... don't know why, but the list version ObjectStepsReqsU 
// causes Effect to bork with type instantiation depth issues when 
// setting up the recursion Service in object_chain.ts ...converting 
// the list to a tuple before extracting the Requirements union seems 
// to avoid that
export type ObjectStepsTupleReqsU<Steps extends NRConsList<UPObjectStepSpec>> =
    ObjectStepsTupleReqsUImpl<ObjectStepsTuple<Steps>>

// get a union of all the Errors from a list of steps
export type ObjectStepErrors<T extends UPObjectStepSpec> =
    T extends UCFxObjectStepSpec<
        infer _K, infer _A, infer _D1, infer _D2, infer _R, infer E, infer _V>
    ? E
    : never
export type ObjectStepsErrorsU<
    List extends NRConsList<UPObjectStepSpec>,
    Acc = never> =
    List extends None
    ? Acc
    : List extends readonly [infer F extends UPObjectStepSpec,
        infer R extends NRConsList<UPObjectStepSpec>]
    ? ObjectStepsErrorsU<R, Acc | ObjectStepErrors<F>>
    : never

// get a tuple of the input types from a tuple of steps
export type ObjectStepInput<T extends UPObjectStepSpec> =
    T extends UCObjectStepSpec<
        infer _K, infer A, infer _D1, infer _D2, infer _R, infer _E, infer _V>
    ? A
    : never
export type ObjectStepsInputTuple<
    List extends NRConsList<UPObjectStepSpec>,
    // deno-lint-ignore no-explicit-any
    Acc extends readonly any[] = []> =
    List extends None
    ? Acc
    : List extends readonly [infer F extends UPObjectStepSpec,
        infer R extends NRConsList<UPObjectStepSpec>]
    ? ObjectStepsInputTuple<R, readonly [...Acc, ObjectStepInput<F>]>
    : never

// get a tuple of the value types from a tuple of steps
export type ObjectStepValue<T extends UPObjectStepSpec> =
    T extends UCObjectStepSpec<
        infer _K, infer _A, infer _D1, infer _D2, infer _R, infer _E, infer V>
    ? V
    : never
export type ObjectStepsValueTuple<
    List extends NRConsList<UPObjectStepSpec>,
    // deno-lint-ignore no-explicit-any
    Acc extends readonly any[] = []> =
    List extends None
    ? Acc
    : List extends readonly [infer F extends UPObjectStepSpec,
        infer R extends NRConsList<UPObjectStepSpec>]
    ? ObjectStepsValueTuple<R, readonly [...Acc, ObjectStepValue<F>]>
    : never

// type a chain to build an Object by chaining an initial value through 
// a sequence of steps, accumulating {K: V} after each step
//
// goal is to *always* hit one of the non-never branches
//
// to this end we infer UCFxObjectStepSpec/UCPureObjectStepSpec
// which is guaranteed to be inferrable
// from elements of an NRCons<UPObjectStepSpec> (as opposed to FxObjectStepSpec,
// which is *not* guaranteed to be inferrable from all UPObjectStepSpecs
// because of the constraints).
// we then apply the pipeline  and internal data constraints in the 
// types we output - this gives us:
// 1. easy to understsand errors about constraint failure
// 2. it's safe to use never in the else branches. they will not be hit

export type ObjectChainSteps<
    Specs extends NRConsList<UPObjectStepSpec>,
    ObjAcc> =

    // case: no more specs
    Specs extends None
    ? None

    // case: there are more specs - add a property to ObjAcc and recurse
    : Specs extends readonly [infer First,
        infer Rest extends NRConsList<UPObjectStepSpec>]
    ? First extends UCFxObjectStepSpec<
        infer FK, infer _FA, infer _FD1, infer FD2,
        infer FR, infer FE, infer FV>
    // recurse - note constraint FD1==FD2
    ? readonly [UCFxObjectStepSpec<FK, ObjAcc, FD2, FD2, FR, FE, FV>,
        ObjectChainSteps<Rest, ObjAcc & { readonly [_K in FK]: FV }>]
    : First extends UCPureObjectStepSpec<infer FK, infer _FA, infer FV>
    ? readonly [UCPureObjectStepSpec<FK, ObjAcc, FV>,
        ObjectChainSteps<Rest, ObjAcc & { readonly [_K in FK]: FV }>]
    : never
    : never

// get the final Object result type from a list of ObjectStepSpecs
export type ObjectChainStepsReturn<
    Specs extends NRConsList<UPObjectStepSpec>,
    ObjAcc> =
    Specs extends None
    ? ObjAcc // empty specs returns the input
    : Last<UPObjectStepSpec,
        ObjectChainSteps<Specs, ObjAcc>> extends UCObjectStepSpec<
            infer LK, infer LA, infer _LD1, infer _LD2,
            infer _LR, infer _LE, infer LV>
    // final Object type adds final step output to the final step input type
    ? Expand<LA & { readonly [_K in LK]: LV }>
    : never

// build an Object with a sequence of ObjectStepSpecs. each step adds
// a new key to the Object
//
// curried to allow passing of initial Obj type while allowing inference of
// other type params
export function objectChainStepsProg<Obj>() {

    return function <const Specs extends NRConsList<UPObjectStepSpec>>
        (objectStepSpecs:
            ObjectChainSteps<Specs, Obj> extends Specs
            ? Specs
            : ObjectChainSteps<Specs, Obj>) {

        // deno-lint-ignore no-explicit-any
        const stepFns: any[] =
            // deno-lint-ignore no-explicit-any
            toTuple<UPObjectStepSpec>()(objectStepSpecs as any).map(
                // deno-lint-ignore no-explicit-any
                (step) => objectStepFn()(step as any))

        const r = stepFns.reduce(
            (prev, stepFn) => {
                // deno-lint-ignore no-explicit-any
                return function (obj: any) {
                    console.log("CREATE objectChainStepsEffect", obj)
                    return Effect.gen(function* (_) {
                        console.log("RUN objectChainStepsEffect", obj)
                        // deno-lint-ignore no-explicit-any
                        const prevStepObj: any = yield* _(prev(obj))
                        console.log("PREV STEP", prevStepObj)
                        // deno-lint-ignore no-explicit-any
                        const stepObj: any = yield* _(stepFn(prevStepObj))
                        console.log("STEP", stepObj)
                        const r = { ...prevStepObj, ...stepObj }
                        console.log("END STEP OBJ", r)
                        return r
                    })
                }
            },
            // start with the no-steps fn
            (obj: Obj) => Effect.succeed(obj))

        return r as (obj: Obj) => Effect.Effect<ObjectStepsReqsU<Specs>,
            ObjectStepsErrorsU<Specs>,
            ObjectChainStepsReturn<Specs, Obj>>
    }
}