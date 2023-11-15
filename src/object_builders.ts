// deno-lint-ignore-file no-explicit-any
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

export type ObjectStepSpec<K extends string, A, D, R, E, V> = PureObjectStepSpec<K, A, V> | FxObjectStepSpec<K, A, D, R, E, V>

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

export type UCPureObjectStepSpec<K extends string, A, V> = PureObjectStepSpec<K, A, V>

export type UCObjectStepSpec<K extends string, A, D1, D2, R, E, V> = UCPureObjectStepSpec<K, A, V> | UCFxObjectStepSpec<K, A, D1, D2, R, E, V>

////////////////////// UnParameterised steps ///////////////////////////

// UnParameterised steps can be used to roughly type tuples of steps, 
// and we can guarantee that the conditional inferences on the 
// UnParameterised types will always reach a non-never leaf node,
// which may then deliver a sensible error to the user

export type UPFxObjectStepSpec = {
    // the key at which the FxFn output V will be added to the Object
    readonly k: string
    // a pure function which maps the input A to the FxFn input D
    readonly inFn: (arg: any) => any
    // an effectful function of D, producing V
    readonly fxFn: UPFxFn
}

export type UPPureObjectStepSpec = {
    readonly k: string
    readonly pureFn: (arg: any) => any
}

// the unparameterised type we will type all step tuples with
export type UPObjectStepSpec = UPPureObjectStepSpec | UPFxObjectStepSpec

//////////////////////// step fn //////////////////////////////////////

// cast an UPObjectStepSpec down to its concrete type
export type ConcreteObjectStepSpec<T extends UPObjectStepSpec> =
    T extends PureObjectStepSpec<infer K, infer A, infer V>
    ? PureObjectStepSpec<K, A, V>
    : T extends UCFxObjectStepSpec<infer K, infer A, infer _D1, infer D2, infer R, infer E, infer V>
    // also apply the D1==D2 constraint
    ? UCFxObjectStepSpec<K, A, D2, D2, R, E, V>
    : never

// the effect returned when a step is run
export type ObjectStepFnReturnEffect<Spec> =
    Spec extends PureObjectStepSpec<infer K, infer _A, infer V>
    ? Effect.Effect<never, never, { [_K in K]: V }>
    : Spec extends FxObjectStepSpec<infer K, infer _A, infer _D, infer R, infer E, infer V>
    ? Effect.Effect<R, E, { [_K in K]: V }>
    : never

// returns a function of Obj which runs a single step, returning {K: V}
// exactly how that {K: V} is combined with Obj is left to the caller
export function objectStepFn<Obj>() {
    return function <Step extends UPObjectStepSpec>
        (step: ConcreteObjectStepSpec<Step> extends Step ? Step : ConcreteObjectStepSpec<Step>) {
        
        return function (obj: Obj) {

            console.log("CREATE OBJECT STEP FN", step.k, step)

            return Effect.gen(function* (_) {
                console.log("RUN OBJECT STEP FN", step.k, step, obj)

                const v = ("pureFn" in step) ? step.pureFn(obj) : yield* _(step.fxFn(step.inFn(obj)))

                console.log("OBJECT STEP FN v", step.k, v)

                const r = { [step.k]: v }
                console.log("END OBJECT STEP FN r", step.k, r)
                return r
            }) as ObjectStepFnReturnEffect<Step>
        }
    }
}

// utility type to get a Union from a Tuple of types
export type UnionFromTuple<Tuple extends readonly any[]> = Tuple[number]

// builds a new Object type from an intersected ObjAcc type,
// making the intellisense much cleaner
// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type ExpandTuple<Tuple extends readonly [...any[]]> = {
    +readonly [Index in keyof Tuple]: Expand<Tuple[Index]>
} & { length: Tuple['length'] }

// get a union of all the R dependencies from a tuple of steps. pure steps have no deps
export type ObjectStepDeps<T extends UPObjectStepSpec> =
    T extends UCFxObjectStepSpec<infer _K, infer _A, infer _D1, infer _D2, infer R, infer _E, infer _V>
    ? R
    : never
export type ObjectStepsDepsU<Tuple extends readonly [...UPObjectStepSpec[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ObjectStepDeps<Tuple[Index]>
} & { length: Tuple['length'] }>

// get a union of all the E errors from a tuple of steps. pure steps declare no errors
export type ObjectStepErrors<T extends UPObjectStepSpec> =
    T extends UCFxObjectStepSpec<infer _K, infer _A, infer _D1, infer _D2, infer _R, infer E, infer _V>
    ? E
    : never
export type ObjectStepsErrorsU<Tuple extends readonly [...UPObjectStepSpec[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ObjectStepErrors<Tuple[Index]>
} & { length: Tuple['length'] }>

// get a tuple of the input types from a tuple of steps
export type ObjectStepInput<T extends UPObjectStepSpec> =
    T extends UCObjectStepSpec<infer _K, infer A, infer _D1, infer _D2, infer _R, infer _E, infer _V>
    ? A
    : never
export type ObjectStepsInputTuple<Tuple extends readonly [...UPObjectStepSpec[]]> = {
    +readonly [Index in keyof Tuple]: ObjectStepInput<Tuple[Index]>
} & { length: Tuple['length'] }

// get a tuple of the value types from a tuple of steps
export type ObjectStepValue<T extends UPObjectStepSpec> =
    T extends UCObjectStepSpec<infer _K, infer _A, infer _D1, infer _D2, infer _R, infer _E, infer V>
    ? V
    : never
export type ObjectStepsValueTuple<Tuple extends readonly [...UPObjectStepSpec[]]> = {
    +readonly [Index in keyof Tuple]: ObjectStepValue<Tuple[Index]>
} & { length: Tuple['length'] }

// type a chain to build an Object by chaining an initial value through 
// a sequence of steps, accumulating {K: V} after each step
//
// goal is to *always* hit one of the non-never branches
//
// to this end we infer UCObjectStepSpec/UCFxObjectStepSpec/UCPureObjectStepSpec
// which is guaranteed to be inferrable
// from elements of an UPObjectStepSpec[] (as opposed to FxObjectStepSpec,
// which is *not* guaranteed to be inferrable from all UPObjectStepSpecs
// because of the constraints).
// we then apply the pipeline  and internal data constraints in the 
// types we output - this gives us:
// 1. easy to understsand errors about constraint failure
// 2. it's safe to use never in the else branches. they will not be hit
export type ChainObjectSteps<Specs extends readonly [...UPObjectStepSpec[]],
    ObjAcc,
    StepAcc extends [...UPObjectStepSpec[]] = []> =

    // case: empty specs
    Specs extends readonly []
    ? readonly [...StepAcc]

    // case: final spec - deliver final pipeline tuple type from StepAcc
    : Specs extends readonly [infer Head]
    ? Head extends UCFxObjectStepSpec<infer K, infer _A, infer _D1, infer D2, infer R, infer E, infer V>
    // return the final inferred pipeline with an FxObjectStepSpec - note we constrain D1==D2
    ? readonly [...StepAcc, UCFxObjectStepSpec<K, ObjAcc, D2, D2, R, E, V>]
    : Head extends UCPureObjectStepSpec<infer K, infer _A, infer V>
    ? readonly [...StepAcc, UCPureObjectStepSpec<K, ObjAcc, V>]
    : never // readonly [...StepAcc, ["ChainObjectStepsFail-final-A: Head !extends UCPureObjectStepSpec", Head]]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends readonly [infer Head, ...infer Tail]
    ? Tail extends readonly [infer Next, ...any]
    ? Next extends UCObjectStepSpec<infer _NK, infer _NA, infer _ND1, infer _ND2, infer _NR, infer _NE, infer _NV>
    ? Head extends UCFxObjectStepSpec<infer HK, infer _HA, infer _HD1, infer HD2, infer HR, infer HE, infer HV>
    // recurse - note constraint HD1==HD2
    ? ChainObjectSteps<Tail,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, UCFxObjectStepSpec<HK, ObjAcc, HD2, HD2, HR, HE, HV>]>
    : Head extends UCPureObjectStepSpec<infer HK, infer _HA, infer HV>
    ? ChainObjectSteps<Tail,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, UCPureObjectStepSpec<HK, ObjAcc, HV>]>
    : never // [...StepAcc, ["ChainObjectStepsFail-recurse-E: Head !extends UCPureObjectStepSpec"]]
    : never // [...StepAcc, ["ChainObjectStepsFail-ecurse-D: Next extends UCObjectStepSpec"]]
    : never // [...StepAcc, ["ChainObjectStepsFail-recurse-B: Tail extends readonly [infer Next, ...any]"]]
    : never // [...StepAcc, ["ChainObjectStepsFail-recurse-A: Specs !extends [infer Head, ...infer Tail]"]]

// get the final Object result type from a list of ObjectStepSpecs
export type ChainObjectStepsReturn<Specs extends readonly [...UPObjectStepSpec[]], ObjAcc> =
    ChainObjectSteps<Specs, ObjAcc> extends readonly [...infer _Prev, infer Last]
    ? Last extends UCObjectStepSpec<infer LK, infer LA, infer _LD1, infer _LD2, infer _LR, infer _LE, infer LV>
    // final Object type adds the final step output to the final step input type
    ? Expand<LA & { [K in LK]: LV }>
    : never // ["ChainObjectStepsReturnFail-B-Last !extends UCObjectStepSpec", Last]
    : never // ["ChainObjectStepsReturnFail-A-ChainObjectSteps<Specs, ObjAcc> !extends", ChainObjectSteps<Specs, ObjAcc>]

// build an Object with a sequence of ObjectStepSpecs. each step adds
// a new key to the Object
//
// curried to allow passing of initial Obj type while allowing inference of other type params
export function chainObjectStepsProg<Obj>() {

    return function <Specs extends readonly [...UPObjectStepSpec[]]>
        (objectStepSpecs: ChainObjectSteps<Specs, Obj> extends readonly [...Specs]
            ? readonly [...Specs]
            : ChainObjectSteps<Specs, Obj>) {

        const stepFns: any[] = objectStepSpecs.map((step) => objectStepFn()(step as any))

        const r = stepFns.reduce(
            (prev, stepFn) => {
                return function (obj: any) {
                    console.log("CREATE chainObjectStepsEffect", obj)
                    return Effect.gen(function* (_) {
                        console.log("RUN chainObjectStepsEffect", obj)
                        const prevStepObj: any = yield* _(prev(obj))
                        console.log("PREV STEP", prevStepObj)
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

        return r as (obj: Obj) => Effect.Effect<ObjectStepsDepsU<Specs>,
            ObjectStepsErrorsU<Specs>,
            ChainObjectStepsReturn<Specs, Obj>>
    }
}


//////////////////////////////////////////////////////////////////////////////

// build an Object by independently mapping each Step over corresponding values in an Inputs tuple,
// accumulating outputs in an Object {K: V}
//
// once again, goal is that we should never hit a never branch - which is why the 
// inferences are slack and constraints are applied by the output
export type TupleMapObjectSteps<Specs extends readonly [...UPObjectStepSpec[]],
    Inputs extends readonly [...any[]],
    StepAcc extends [...UPObjectStepSpec[]] = []> =

    // case: empty specs
    Specs extends readonly []
    ? readonly [...StepAcc]

    // case: final spec - deliver final pipeline tuple type from StepAcc
    : Specs extends readonly [infer Head]
    ? Inputs extends readonly [infer HeadIn]
    ? Head extends UCFxObjectStepSpec<infer K, infer _A, infer _D1, infer D2, infer R, infer E, infer V>
    // return the final inferred pipeline
    ? readonly [...StepAcc, UCObjectStepSpec<K, HeadIn, D2, D2, R, E, V>]
    : Head extends UCPureObjectStepSpec<infer K, infer _A, infer V>
    ? readonly [...StepAcc, UCPureObjectStepSpec<K, HeadIn, V>]
    : never // ["TupleMapObjectStepsFail", "final-B: Head extends UCPureObjectStepSpec", Specs]
    : never // ["TupleMapObjectStepsFail", "final-A: Inputs extends [infer HeadIn]", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends readonly [infer Head, ...infer Tail]
    ? Tail extends readonly [infer Next, ...any]
    ? Inputs extends readonly [infer HeadIn, ...infer TailIn]
    ? TailIn extends readonly [infer NextIn, ...any]
    ? Next extends UCObjectStepSpec<infer _NK, infer _NA, infer _ND1, infer _ND2, infer _NR, infer _NE, infer _NV>
    ? Head extends UCFxObjectStepSpec<infer HK, infer _HA, infer _HD1, infer HD2, infer HR, infer HE, infer HV>
    // recurse
    ? TupleMapObjectSteps<Tail,
        TailIn,
        [...StepAcc, UCFxObjectStepSpec<HK, HeadIn, HD2, HD2, HR, HE, HV>]>
    : Head extends UCPureObjectStepSpec<infer HK, infer _HA, infer HV>
    ? TupleMapObjectSteps<Tail,
        TailIn,
        [...StepAcc, UCPureObjectStepSpec<HK, HeadIn, HV>]>
    : never // ["TupleMapObjectStepsFail", "recurse-G: Head extends UCPureObjectStepSpec"]
    : never // ["TupleMapObjectStepsFail", "recurse-F: Next extends UCObjectStepSpec"]
    : never // ["TupleMapObjectStepsFail", "recurse-E: TailIn extends readonly [infer NextIn, ...any]"]
    : never // ["TupleMapObjectStepsFail", "recurse-C: Inputs extends readonly [infer HeadIn, ...infer TailIn]"]
    : never // ["TupleMapObjectStepsFail", "recurse-B: Tail extends readonly [infer Next, ...any]"]
    : never // ["TupleMapObjectStepsFail", "recurse-A: Specs extends readonly [infer Head, ...infer Tail]"]

// calculate the return type ... since the array type is not chained through
// the calculation, calculating the return type looks very similar to checking
// the step constraints, but we accumulate the return type rather than the 
// inferred steps
export type TupleMapObjectStepsReturn<Specs extends readonly [...UPObjectStepSpec[]],
    Inputs extends readonly [...any[]],
    // the lint recommendation messes up the return type here, so ignoring it
    // deno-lint-ignore ban-types
    ObjAcc = {},
    StepAcc extends [...UPObjectStepSpec[]] = []> =

    // case: final spec - return type 
    Specs extends readonly [infer Head]
    ? Inputs extends readonly [infer HeadIn]
    ? Head extends UCFxObjectStepSpec<infer K, infer _A, infer _D1, infer _D2, infer _R, infer _E, infer V>
    // return the final inferred pipeline
    ? Expand<ObjAcc & { [KK in K]: V }>
    : Head extends UCPureObjectStepSpec<infer K, infer _A, infer V>
    ? Expand<ObjAcc & { [KK in K]: V }>
    : never // ["TupleMapObjectStepsReturnFail", "final-B: Head extends ObjectStepSpec", Specs]
    : never // ["TupleMapObjectStepsReturnFail", "final-A: Inputs extends [infer HeadIn]", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends readonly [infer Head, ...infer Tail]
    ? Tail extends readonly [infer Next, ...any]
    ? Inputs extends readonly [infer HeadIn, ...infer TailIn]
    ? TailIn extends readonly [infer NextIn, ...any]
    ? Next extends UCObjectStepSpec<infer _NK, infer _A, infer _ND1, infer _ND1, infer _NR, infer _NE, infer _NV>
    ? Head extends UCFxObjectStepSpec<infer HK, infer _A, infer _HD1, infer HD2, infer HR, infer HE, infer HV>
    // recurse
    ? TupleMapObjectStepsReturn<Tail,
        TailIn,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, UCFxObjectStepSpec<HK, HeadIn, HD2, HD2, HR, HE, HV>]>
    : Head extends UCPureObjectStepSpec<infer HK, infer _A, infer HV>
    ? TupleMapObjectStepsReturn<Tail,
        TailIn,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, UCPureObjectStepSpec<HK, HeadIn, HV>]>
    : never // ["TupleMapObjectStepsReturnFail", "recurse-G: Head extends UCPureObjectStepSpec"]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-F: Next extends UCObjectStepSpec"]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-E: TailIn extends readonly [infer NextIn, ...any]"]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-C: Inputs extends readonly [infer HeadIn, ...infer TailIn]"]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-B: Tail extends readonly [infer Next, ...any]"]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-A: Specs extends [infer Head, ...infer Tail]"]

export function tupleMapObjectStepsProg<Inputs extends readonly [...any[]]>() {

    return function <Specs extends readonly [...UPObjectStepSpec[]] & {length: Inputs['length']}>

        (objectStepSpecs: TupleMapObjectSteps<Specs, Inputs> extends readonly [...Specs]
            ? readonly [...Specs]
            : TupleMapObjectSteps<Specs, Inputs>) {

        const stepFns = objectStepSpecs.map((step) => objectStepFn()(step as any))

        const r = function (inputs: Inputs) {
            console.log("CREATE TUPLE_MAP EFFECT", inputs)
            return Effect.gen(function* (_) {
                console.log("RUN TUPLE_MAP EFFECT", inputs)

                const oEffects = stepFns.map((stepFn, i) => stepFn(inputs[i]))

                // docs says Effect.all runs effects in sequence - which is what we need (since
                // tuple return is intended to reflect an ordering dependency)
                const oVals = yield* _(Effect.all(oEffects))
                const oMap = oVals.reduce((rObj: any, stepObj: any) => {
                    return { ...rObj, ...stepObj }
                },
                    {})

                console.log("END TUPLE_MAP", oMap)
                return oMap
            })
        }

        return r as (inputs: Inputs) => Effect.Effect<ObjectStepsDepsU<Specs>,
            ObjectStepsErrorsU<Specs>,
            TupleMapObjectStepsReturn<Specs, Inputs>>
    }
}
