// deno-lint-ignore-file no-explicit-any
import { Effect } from "effect"
import { FxFn } from "./fx_fn.ts"

// inspiration:
// https://dev.to/ecyrbe/how-to-use-advanced-typescript-to-define-a-pipe-function-381h

// an ObjectStepSpec defines a single Effectful step towards building an Object.
// - inFn transforms an input A into the argument D of 
// the FxFn, and the output of the FxFn V will be added to the
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
    // the key at which the FxFn output V will be added to the Object
    readonly k: K
    // a pure function which maps the input A to the FxFn input D
    readonly inFn: (arg: A) => D
    // an effectful function of D, producing V
    readonly fxFn: FxFn<D, R, E, V>
}

// THOUGHT: maybe want an unconstrained ObjectStepSpec - UCObjectStepSpec - where the two uses of D are
// represented as separate type parameters - so that an element from a UPObjectStepSpec[] can *always* 
// be parsed as an UnObjectStepSpec and we can enforce the D1=D2 constraint by rewriting the type...
// the advantage would be that we don't get any hard-to-read type errors, instead we just get (good) 
// boring "D2 is not assignable to D1" kinda errors, and we can also use never in all the else branches
// because we know every UPObjectStepSpec is always inferrable as a UCObjectStepSpec

export type UCObjectStepSpec<K extends string, A, D1, D2, R, E, V> = {
    // the key at which the FxFn output V will be added to the Object
    readonly k: K
    // a pure function which maps the input A to the FxFn input D
    readonly inFn: (arg: A) => D1
    // an effectful function of D, producing V
    readonly fxFn: FxFn<D2, R, E, V>
}

// an unparameterised ObjectStepSpec we can use to "roughly" type arrays
export type UPObjectStepSpec = {
    readonly k: string
    readonly inFn: (arg: any) => any
    readonly fxFn: (arg: any) => Effect.Effect<any, any, any>
}

// returns a function of Obj which returns an Effect of {K: V}
export function objectStepFn<Obj>() {
    return function <K extends string, D, R, E, V>(step: ObjectStepSpec<K, Obj, D, R, E, V>) {
        return function (obj: Obj) {
            console.log("CREATE OBJECT STEP FN", step.k, step)

            return Effect.gen(function* (_) {
                console.log("RUN OBJECT STEP FN", step.k, step, obj)
                const d = step.inFn(obj)
                console.log("OBJECT STEP FN d", step.k, d)
                const v = yield* _(step.fxFn(d))
                console.log("OBJECT STEP FN v", step.k, v)
                // new key gets typed as a string without the cast
                const r = { [step.k]: v } as { [_K in K]: V }
                console.log("END OBJECT STEP FN r", step.k, r)
                return r
            })
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

// get a union of all the R dependencies from a tuple of steps
export type ObjectStepDeps<T extends UPObjectStepSpec> = T extends UCObjectStepSpec<infer _K, infer _A, infer _D1, infer _D2, infer R, infer _E, infer _V> ? R : never
export type ObjectStepsDepsU<Tuple extends readonly [...UPObjectStepSpec[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ObjectStepDeps<Tuple[Index]>
} & { length: Tuple['length'] }>

// get a union of all the E errors from a tuple of steps
export type ObjectStepErrors<T extends UPObjectStepSpec> = T extends UCObjectStepSpec<infer _K, infer _A, infer _D1, infer _D2, infer _R, infer E, infer _V> ? E : never
export type ObjectStepsErrorsU<Tuple extends readonly [...UPObjectStepSpec[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ObjectStepErrors<Tuple[Index]>
} & { length: Tuple['length'] }>

// get a tuple of the input types from a tuple of steps
export type ObjectStepInput<T extends UPObjectStepSpec> = T extends UCObjectStepSpec<infer _K, infer A, infer _D1, infer _D2, infer _R, infer _E, infer _V> ? A : never
export type ObjectStepsInputTuple<Tuple extends readonly [...UPObjectStepSpec[]]> = {
    +readonly [Index in keyof Tuple]: ObjectStepInput<Tuple[Index]>
} & { length: Tuple['length'] }

// get a tuple of the value types from a tuple of steps
export type ObjectStepValue<T extends UPObjectStepSpec> = T extends UCObjectStepSpec<infer _K, infer _A, infer _D1, infer _D2, infer _R, infer _E, infer V> ? V : never
export type ObjectStepsValueTuple<Tuple extends readonly [...UPObjectStepSpec[]]> = {
    +readonly [Index in keyof Tuple]: ObjectStepValue<Tuple[Index]>
} & { length: Tuple['length'] }

// type a chain to build an Object by chaining an initial value through 
// a sequence of steps, accumulating {K: V} after each step
//
// note we infer UCObjectStepSpec which is guaranteed to be inferrable
// from elements of an UPObjectStepSpec[], as opposed to ObjectStepSpec,
// which is *not* guaranteed to be inferrable from all UPObjectStepSpecs.
// we then apply the pipeline  and internal data constraints in the 
// types we output - this gives us:
// 1. easy to understsand errors about constraint failure
// 2. it's safe to use never in the else branches
type ChainObjectSteps<Specs extends readonly [...UPObjectStepSpec[]],
    ObjAcc,
    StepAcc extends [...UPObjectStepSpec[]] = []> =

    // case: empty specs
    Specs extends readonly []
    ? readonly [...StepAcc]

    // case: final spec - deliver final pipeline tuple type from StepAcc
    : Specs extends readonly [infer Head]
    ? Head extends UCObjectStepSpec<infer K, infer _A, infer _D1, infer D2, infer R, infer E, infer V>
    // return the final inferred pipeline - note we constrain D1==D2
    ? readonly [...StepAcc, UCObjectStepSpec<K, ObjAcc, D2, D2, R, E, V>]
    : never // readonly [...StepAcc, ["ChainObjectStepsFail-final-A: Head !extends ObjectStepSpec", Head]]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends readonly [infer Head, ...infer Tail]
    ? Head extends UCObjectStepSpec<infer HK, infer _HA, infer _HD1, infer HD2, infer HR, infer HE, infer HV>
    ? Tail extends readonly [infer Next, ...any]
    ? Next extends UCObjectStepSpec<infer _NK, infer _NA, infer _ND1, infer _ND2, infer _NR, infer _NE, infer _NV>
    // recurse - note constraint HD1==HD2
    ? ChainObjectSteps<Tail,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, UCObjectStepSpec<HK, ObjAcc, HD2, HD2, HR, HE, HV>]>
    : never // [...StepAcc, ["ChainObjectStepsFail-recurse-E: Next !extends ObjectStepSpec", Next]]
    : never // [...StepAcc, ["ChainObjectStepsFail-ecurse-D: Tail !extends [infer Next, ...any]", Tail]]
    : never // [...StepAcc, ["ChainObjectStepsFail-recurse-B: Head !extends ObjectStepSpec", Head]]
    : never // [...StepAcc, ["ChainObjectStepsFail-recurse-A: Specs !extends [infer Head, ...infer Tail]", Specs]]

// get the final Object result type from a list of ObjectStepSpecs
export type ChainObjectStepsReturn<Specs extends readonly [...UPObjectStepSpec[]], ObjAcc> =
    ChainObjectSteps<Specs, ObjAcc> extends readonly [...infer _Prev, infer Last]
    ? Last extends UCObjectStepSpec<infer LK, infer LA, infer _LD1, infer _LD2, infer _LR, infer _LE, infer LV>
    // final Object type adds the final step output to the final step input type
    ? Expand<LA & { [K in LK]: LV }>
    : never // ["ChainObjectStepsReturnFail-B-Last !extends ObjectStepSpec", Last]
    : never // ["ChainObjectStepsReturnFail-A-ChainObjectSteps<Specs, ObjAcc> !extends", ChainObjectSteps<Specs, ObjAcc>]

// since we want to pass an initial Data type param, but to infer 
// ObjectStepSpecs - and typescript inference is all-or-nothing, we must curry
// https://effectivetypescript.com/2020/12/04/gentips-1-curry/
// export declare function chainObjectStepsProg<Init>():
//     <ObjectStepSpecs extends readonly [...any[]]>

//         // and this trick allows the ObjectStepSpecs param to be typed as
//         //   readonly[...ObjectStepSpecs]
//         // while also applying the ChainObjectSteps type checks
//         (_ObjectStepSpecs: ChainObjectSteps<ObjectStepSpecs, Init> extends readonly [...ObjectStepSpecs]
//             ? readonly [...ObjectStepSpecs]
//             : ChainObjectSteps<ObjectStepSpecs, Init>)

//         => (arg: Init) => Effect.Effect<never, never, ChainObjectStepsReturn<ObjectStepSpecs, Init>>

export function chainObjectStepsProg<Init>() {

    return function <Specs extends readonly [...UPObjectStepSpec[]]>
        (objectStepSpecs: ChainObjectSteps<Specs, Init> extends readonly [...Specs]
            ? readonly [...Specs]
            : ChainObjectSteps<Specs, Init>) {

        // i think we would need existential types to type this implementation
        const stepFns: any[] = objectStepSpecs.map((step) => objectStepFn()(step as any))

        const r = stepFns.reduce(
            (prev, stepFn) => {
                return function (obj: any) {
                    console.log("CREATE CHAIN EFFECT", obj)
                    return Effect.gen(function* (_) {
                        console.log("RUN CHAIN EFFECT", obj)
                        const prevStepObj: any = yield* _(prev(obj))
                        const stepIn = { ...obj, ...prevStepObj }
                        console.log("PREV STEP", prevStepObj)
                        const stepObj: any = yield* _(stepFn(stepIn))
                        console.log("STEP", stepObj)
                        const r = { ...prevStepObj, ...stepObj }
                        console.log("END STEP OBJ", r)
                        return r
                    })
                }
            },
            // start with the no-steps fn
            (obj: Init) => Effect.succeed(obj))

        return r as (obj: Init) => Effect.Effect<ObjectStepsDepsU<Specs>,
            ObjectStepsErrorsU<Specs>,
            ChainObjectStepsReturn<Specs, Init>>
    }
}


//////////////////////////////////////////////////////////////////////////////

// build an Object by independently mapping each Step over corresponding values in an Inputs tuple,
// accumulating outputs in an Object {K: V}
type TupleMapObjectSteps<Specs extends readonly [...UPObjectStepSpec[]],
    Inputs extends readonly [...any[]],
    StepAcc extends [...UPObjectStepSpec[]] = []> =

    // case: empty specs
    Specs extends readonly []
    ? readonly [...StepAcc]

    // case: final spec - deliver final pipeline tuple type from StepAcc
    : Specs extends readonly [infer Head]
    ? Inputs extends readonly [infer HeadIn]
    ? Head extends UCObjectStepSpec<infer K, HeadIn, infer _D1, infer D2, infer R, infer E, infer V>
    // return the final inferred pipeline
    ? readonly [...StepAcc, UCObjectStepSpec<K, HeadIn, D2, D2, R, E, V>]
    : never // ["TupleMapObjectStepsFail", "final-B: Head extends ObjectStepSpec", Specs]
    : never // ["TupleMapObjectStepsFail", "final-A: Inputs extends [infer HeadIn]", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends readonly [infer Head, ...infer Tail]
    ? Inputs extends readonly [infer HeadIn, ...infer TailIn]
    ? Head extends UCObjectStepSpec<infer HK, HeadIn, infer _HD1, infer HD2, infer HR, infer HE, infer HV>
    ? Tail extends readonly [infer Next, ...any]
    ? TailIn extends readonly [infer NextIn, ...any]
    ? Next extends UCObjectStepSpec<infer _NK, NextIn, infer _ND1, infer _ND2, infer _NR, infer _NE, infer _NV>
    // recurse
    ? TupleMapObjectSteps<Tail,
        TailIn,
        [...StepAcc, UCObjectStepSpec<HK, HeadIn, HD2, HD2, HR, HE, HV>]>
    : never // ["TupleMapObjectStepsFail", "recurse-G: Next extends ObjectStepSpec", Specs]
    : never // ["TupleMapObjectStepsFail", "recurse-F: TailIn extends [infer NextIn, ...any]", Specs]
    : never // ["TupleMapObjectStepsFail", "recurse-E: Tail extends [infer Next, ...any]", Specs]
    : never // ["TupleMapObjectStepsFail", "recurse-C: Head extends ObjectStepSpec", Specs]
    : never // ["TupleMapObjectStepsFail", "recurse-B: Inputs extends [infer HeadIn, ...infer TailIn]", Specs]
    : never // ["TupleMapObjectStepsFail", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]

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
    ? Head extends UCObjectStepSpec<infer K, HeadIn, infer _D1, infer _D2, infer _R, infer _E, infer V>
    // return the final inferred pipeline
    ? Expand<ObjAcc & { [KK in K]: V }>
    : never // ["TupleMapObjectStepsReturnFail", "final-B: Head extends ObjectStepSpec", Specs]
    : never // ["TupleMapObjectStepsReturnFail", "final-A: Inputs extends [infer HeadIn]", Specs]

    // case: there are more specs - add to ObjAcc and StepAcc and recurse
    : Specs extends readonly [infer Head, ...infer Tail]
    ? Inputs extends readonly [infer HeadIn, ...infer TailIn]
    ? Head extends UCObjectStepSpec<infer HK, HeadIn, infer _HD1, infer HD2, infer HR, infer HE, infer HV>
    ? Tail extends readonly [infer Next, ...any]
    ? TailIn extends readonly [infer NextIn, ...any]
    ? Next extends UCObjectStepSpec<infer _NK, NextIn, infer _ND1, infer _ND1, infer _NR, infer _NE, infer _NV>
    // recurse
    ? TupleMapObjectStepsReturn<Tail,
        TailIn,
        ObjAcc & { [K in HK]: HV },
        [...StepAcc, UCObjectStepSpec<HK, HeadIn, HD2, HD2, HR, HE, HV>]>
    : never // ["TupleMapObjectStepsReturnFail", "recurse-G: Next extends ObjectStepSpec", Specs]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-F: TailIn extends [infer NextIn, ...any]", Specs]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-E: Tail extends [infer Next, ...any]", Specs]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-C: Head extends ObjectStepSpec", Specs]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-B: Inputs extends [infer HeadIn, ...infer TailIn]", Specs]
    : never // ["TupleMapObjectStepsReturnFail", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]

// once again, want to provide the Inputs type, but infer the ObjectStepSpecs type,
// so we have to curry
// export declare function tupleMapObjectStepsProg<Inputs extends readonly [...any[]]>():
//     <ObjectStepSpecs extends readonly [...any[]]>

//         (_ObjectStepSpecs: TupleMapObjectSteps<ObjectStepSpecs, Inputs> extends readonly [...ObjectStepSpecs]
//             ? readonly [...ObjectStepSpecs]
//             : TupleMapObjectSteps<ObjectStepSpecs, Inputs>)

//         => (inputs: Inputs) => Effect.Effect<never, never, TupleMapObjectStepsReturn<ObjectStepSpecs, Inputs>>

export function tupleMapObjectStepsProg<Inputs extends readonly [...any[]]>() {

    return function <Specs extends readonly [...UPObjectStepSpec[]]>

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
