import { Effect } from "effect"
import { FxFn, UPFxFn } from "./fx_fn.ts"

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

// UnConstrainted steps allow for guaranteed-successful conditional 
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

// UnParameterised steps can be used to roughly type tuples of steps, 
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

//////////////////////// step fn //////////////////////////////////////

// cast an UPObjectStepSpec down to its concrete type
export type ConcreteObjectStepSpec<T extends UPObjectStepSpec> =
    T extends PureObjectStepSpec<infer K, infer A, infer V>
    ? PureObjectStepSpec<K, A, V>
    : T extends UCFxObjectStepSpec<
        infer K, infer A, infer _D1, infer D2, infer R, infer E, infer V>
    // also apply the D1==D2 constraint
    ? UCFxObjectStepSpec<K, A, D2, D2, R, E, V>
    : never

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
        (step: ConcreteObjectStepSpec<Step> extends Step
            ? Step : ConcreteObjectStepSpec<Step>) {

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

// get a union of all the R dependencies from a tuple of steps. 
// pure steps have no deps
export type ObjectStepReqs<T extends UPObjectStepSpec> =
    T extends UCFxObjectStepSpec<
        infer _K, infer _A, infer _D1, infer _D2, infer R, infer _E, infer _V>
    ? R
    : never
export type ObjectStepsReqsU<
    Tuple extends readonly [...UPObjectStepSpec[]]> = UnionFromTuple<{
        +readonly [Index in keyof Tuple]: ObjectStepReqs<Tuple[Index]>
    } & { length: Tuple['length'] }>

// get a union of all the E errors from a tuple of steps. pure steps 
// declare no errors
export type ObjectStepErrors<T extends UPObjectStepSpec> =
    T extends UCFxObjectStepSpec<
        infer _K, infer _A, infer _D1, infer _D2, infer _R, infer E, infer _V>
    ? E
    : never
export type ObjectStepsErrorsU<
    Tuple extends readonly [...UPObjectStepSpec[]]> = UnionFromTuple<{
        +readonly [Index in keyof Tuple]: ObjectStepErrors<Tuple[Index]>
    } & { length: Tuple['length'] }>

// get a tuple of the input types from a tuple of steps
export type ObjectStepInput<T extends UPObjectStepSpec> =
    T extends UCObjectStepSpec<
        infer _K, infer A, infer _D1, infer _D2, infer _R, infer _E, infer _V>
    ? A
    : never
export type ObjectStepsInputTuple<
    Tuple extends readonly [...UPObjectStepSpec[]]> = {
        +readonly [Index in keyof Tuple]: ObjectStepInput<Tuple[Index]>
    } & { length: Tuple['length'] }

// get a tuple of the value types from a tuple of steps
export type ObjectStepValue<T extends UPObjectStepSpec> =
    T extends UCObjectStepSpec<
        infer _K, infer _A, infer _D1, infer _D2, infer _R, infer _E, infer V>
    ? V
    : never
export type ObjectStepsValueTuple<
    Tuple extends readonly [...UPObjectStepSpec[]]> = {
        +readonly [Index in keyof Tuple]: ObjectStepValue<Tuple[Index]>
    } & { length: Tuple['length'] }



// TODO: tried to change the Specs array to a cons structure - 
// arrays are causing "type instantiation is excessively deep" errors with
// iterative step composition, probably because each step requires the 
// full arrays of the previous steps to be parsed too, leading to N^2 depth. 
// if we use a cons
// structure then (i think) iterative step composition will have the same type 
// complexity as array-based all-in-one-hit
// ... however ... an iterative cons types seems to cause the typescript 
// compiler much more trouble than the array types, and i failed to find a 
// structure that didn't cause slow inference and "type instantiation is 
// excessively deep" errors, so i'm stuck with all-in-one-hit arrays for 
// the moment



// type a chain to build an Object by chaining an initial value through 
// a sequence of steps, accumulating {K: V} after each step
//
// goal is to *always* hit one of the non-never branches
//
// to this end we infer UCFxObjectStepSpec/UCPureObjectStepSpec
// which is guaranteed to be inferrable
// from elements of an UPObjectStepSpec[] (as opposed to FxObjectStepSpec,
// which is *not* guaranteed to be inferrable from all UPObjectStepSpecs
// because of the constraints).
// we then apply the pipeline  and internal data constraints in the 
// types we output - this gives us:
// 1. easy to understsand errors about constraint failure
// 2. it's safe to use never in the else branches. they will not be hit
export type ObjectChainSteps<Specs extends readonly [...UPObjectStepSpec[]],
    ObjAcc,
    StepAcc extends [...UPObjectStepSpec[]] = []> =

    // case: empty specs
    Specs extends readonly []
    ? readonly [...StepAcc]

    // case: final spec - deliver final pipeline tuple type from StepAcc
    : Specs extends readonly [infer Head]
    ? Head extends UCFxObjectStepSpec<
        infer K, infer _A, infer _D1, infer D2, infer R, infer E, infer V>
    // return the final inferred pipeline with an FxObjectStepSpec 
    // - note we constrain D1 == D2 here
    ? readonly [...StepAcc, UCFxObjectStepSpec<K, ObjAcc, D2, D2, R, E, V>]
    : Head extends UCPureObjectStepSpec<infer K, infer _A, infer V>
    ? readonly [...StepAcc, UCPureObjectStepSpec<K, ObjAcc, V>]
    : never

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends readonly [infer Head, ...infer Tail]
    // deno-lint-ignore no-explicit-any
    ? Tail extends readonly [infer Next, ...any]
    ? Next extends UCObjectStepSpec<
        infer _NK, infer _NA, infer _ND1, infer _ND2,
        infer _NR, infer _NE, infer _NV>
    ? Head extends UCFxObjectStepSpec<
        infer HK, infer _HA, infer _HD1, infer HD2,
        infer HR, infer HE, infer HV>
    // recurse - note constraint HD1==HD2
    ? ObjectChainSteps<Tail,
        ObjAcc & { readonly [_K in HK]: HV },
        [...StepAcc, UCFxObjectStepSpec<HK, ObjAcc, HD2, HD2, HR, HE, HV>]>
    : Head extends UCPureObjectStepSpec<infer HK, infer _HA, infer HV>
    ? ObjectChainSteps<Tail,
        ObjAcc & { readonly [_K in HK]: HV },
        [...StepAcc, UCPureObjectStepSpec<HK, ObjAcc, HV>]>
    : never
    : never
    : never
    : never

// get the final Object result type from a list of ObjectStepSpecs
export type ObjectChainStepsReturn<
    Specs extends readonly [...UPObjectStepSpec[]], ObjAcc> =
    Specs extends readonly []
    ? ObjAcc // empty specs returns the input
    : ObjectChainSteps<
        Specs, ObjAcc> extends readonly [...infer _Prev, infer Last]
    ? Last extends UCObjectStepSpec<infer LK, infer LA, infer _LD1, infer _LD2,
        infer _LR, infer _LE, infer LV>
    // final Object type adds final step output to the final step input type
    ? Expand<LA & { readonly [_K in LK]: LV }>
    : never
    : never

// build an Object with a sequence of ObjectStepSpecs. each step adds
// a new key to the Object
//
// curried to allow passing of initial Obj type while allowing inference of
// other type params
export function objectChainStepsProg<Obj>() {

    return function <Specs extends readonly [...UPObjectStepSpec[]]>
        (objectStepSpecs:
            ObjectChainSteps<Specs, Obj> extends readonly [...Specs]
            ? readonly [...Specs]
            : ObjectChainSteps<Specs, Obj>) {

        // deno-lint-ignore no-explicit-any
        const stepFns: any[] = objectStepSpecs.map(
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