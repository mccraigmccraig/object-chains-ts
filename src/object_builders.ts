// deno-lint-ignore-file no-explicit-any
import { Effect } from "effect"
import { FxServiceFn } from "./fx_service_fn.ts"

// inspiration:
// https://dev.to/ecyrbe/how-to-use-advanced-typescript-to-define-a-pipe-function-381h

// an ObjectStepSpec defines a single Effectful step towards building an Object.
// - inFn transforms an input A into the argument D of 
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
    readonly inFn: (arg: A) => D
    // an effectful function of D, producing V
    readonly svcFn: FxServiceFn<D, R, E, V>
}

// returns a function of Obj which augments Obj according to the ObjectStepSpec
function buildObjectStepFn<Obj>() {
    return function <K extends string, D, R, E, V>(step: ObjectStepSpec<K, Obj, D, R, E, V>) {
        return function (obj: Obj) {
            return Effect.gen(function* (_) {
                const d = step.inFn(obj)
                const v = yield* _(step.svcFn(d))
                // new key gets typed as a string without the cast
                // (and yeuch mutable objects)
                const r = { ...obj, [step.k]: v } as Obj & { [_K in K]: V }
                return r
            })
        }
    }
}

// build an Object by chaining an initial value through a sequence
// of steps, accumulating {K: V} after each step
type ChainObjectSteps<Specs extends readonly [...any[]],
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
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// get the final Object result type from a list of ObjectStepSpecs
type ChainObjectStepsReturn<Specs extends readonly [...any[]], ObjAcc> =
    ChainObjectSteps<Specs, ObjAcc> extends readonly [...infer _Prev, infer Last]
    ? Last extends ObjectStepSpec<infer LK, infer LA, infer _LD, infer _LR, infer _LE, infer LV>
    // final Object type adds the final step output to the final step input type
    ? Expand<LA & { [K in LK]: LV }>
    : ["ChainObjectStepsReturnFail", "B-Last extends ObjectStepSpec", ChainObjectSteps<Specs, ObjAcc>]
    : ["ChainObjectStepsReturnFail", "A-ChainObjectSteps<Specs, ObjAcc> extends", ChainObjectSteps<Specs, ObjAcc>]

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

    return function <ObjectStepSpecs extends readonly [...any[]]>
        (objectStepSpecs: ChainObjectSteps<ObjectStepSpecs, Init> extends readonly [...ObjectStepSpecs]
            ? readonly [...ObjectStepSpecs]
            : ChainObjectSteps<ObjectStepSpecs, Init>) {

        const r = objectStepSpecs.toReversed().reduce(
            (prev, step) => {
                const stepFn = buildObjectStepFn()(step)
                return function (obj: any) {
                    return Effect.gen(function* (_) {
                        const nobj = yield* _(prev(obj))
                        const r = yield* _(stepFn(nobj))
                        return r
                    })
                }
            },
            // start with the no-steps fn
            (obj: Init) => Effect.succeed(obj))

        return r as (obj: Init) => Effect.Effect<never, never, ChainObjectStepsReturn<ObjectStepSpecs, Init>>
    }
}


//////////////////////////////////////////////////////////////////////////////

// build an Object by independently mapping each Step over corresponding values in an Inputs tuple,
// accumulating outputs in an Object {K: V}
type TupleMapObjectSteps<Specs extends readonly [...any[]],
    Inputs extends readonly [...any[]],
    StepAcc extends [...any[]] = []> =

    // case: final spec - deliver final pipeline tuple type from StepAcc
    Specs extends [infer Head]
    ? Inputs extends [infer HeadIn]
    ? Head extends ObjectStepSpec<infer K, HeadIn, infer D, infer R, infer E, infer V>
    // return the final inferred pipeline
    ? readonly [...StepAcc, ObjectStepSpec<K, HeadIn, D, R, E, V>]
    : ["TupleMapObjectStepsFail", "final-B: Head extends ObjectStepSpec", Specs]
    : ["TupleMapObjectStepsFail", "final-A: Inputs extends [infer HeadIn]", Specs]

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
    : ["TupleMapObjectStepsFail", "recurse-G: Next extends ObjectStepSpec", Specs]
    : ["TupleMapObjectStepsFail", "recurse-F: TailIn extends [infer NextIn, ...any]", Specs]
    : ["TupleMapObjectStepsFail", "recurse-E: Tail extends [infer Next, ...any]", Specs]
    : ["TupleMapObjectStepsFail", "recurse-C: Head extends ObjectStepSpec", Specs]
    : ["TupleMapObjectStepsFail", "recurse-B: Inputs extends [infer HeadIn, ...infer TailIn]", Specs]
    : ["TupleMapObjectStepsFail", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]

// calculate the return type ... since the array type is not chained through
// the calculation, calculating the return type looks very similar to checking
// the step constraints, but we accumulate the return type rather than the 
// inferred steps
type TupleMapObjectStepsReturn<Specs extends readonly [...any[]],
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
    : ["TupleMapObjectStepsReturnFail", "final-B: Head extends ObjectStepSpec", Specs]
    : ["TupleMapObjectStepsReturnFail", "final-A: Inputs extends [infer HeadIn]", Specs]

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
    : ["TupleMapObjectStepsReturnFail", "recurse-G: Next extends ObjectStepSpec", Specs]
    : ["TupleMapObjectStepsReturnFail", "recurse-F: TailIn extends [infer NextIn, ...any]", Specs]
    : ["TupleMapObjectStepsReturnFail", "recurse-E: Tail extends [infer Next, ...any]", Specs]
    : ["TupleMapObjectStepsReturnFail", "recurse-C: Head extends ObjectStepSpec", Specs]
    : ["TupleMapObjectStepsReturnFail", "recurse-B: Inputs extends [infer HeadIn, ...infer TailIn]", Specs]
    : ["TupleMapObjectStepsReturnFail", "recurse-A: Specs extends [infer Head, ...infer Tail]", Specs]

// once again, want to provide the Inputs type, but infer the ObjectStepSpecs type,
// so we have to curry
// export declare function tupleMapObjectStepsProg<Inputs extends readonly [...any[]]>():
//     <ObjectStepSpecs extends readonly [...any[]]>

//         (_ObjectStepSpecs: TupleMapObjectSteps<ObjectStepSpecs, Inputs> extends readonly [...ObjectStepSpecs]
//             ? readonly [...ObjectStepSpecs]
//             : TupleMapObjectSteps<ObjectStepSpecs, Inputs>)

//         => (inputs: Inputs) => Effect.Effect<never, never, TupleMapObjectStepsReturn<ObjectStepSpecs, Inputs>>

export function tupleMapObjectStepsProg<Inputs extends readonly [...any[]]>() {

    return function <ObjectStepSpecs extends readonly [...any[]]>

        (objectStepSpecs: TupleMapObjectSteps<ObjectStepSpecs, Inputs> extends readonly [...ObjectStepSpecs]
            ? readonly [...ObjectStepSpecs]
            : TupleMapObjectSteps<ObjectStepSpecs, Inputs>) {

        const stepFns = objectStepSpecs.map((step) => buildObjectStepFn()(step))

        const r = function (inputs: Inputs) {
            return Effect.gen(function* (_) {
                const oEffects = stepFns.map((stepFn, i) => stepFn(inputs[i]))

                // docs says Effect.all runs effects in sequence - which is what we need (since
                // tuple return is intended to reflect an ordering dependency)
                const oVals = yield* _(Effect.all(oEffects))
                const oMap = oVals.reduce((rObj: any, stepObj: any) => {
                    return { ...rObj, ...stepObj }
                },
                    {})
                return oMap
            })
        }

        return r as (inputs: Inputs) => Effect.Effect<never, never, TupleMapObjectStepsReturn<ObjectStepSpecs, Inputs>>
    }
}