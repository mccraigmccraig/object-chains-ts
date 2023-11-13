// deno-lint-ignore-file no-explicit-any
import { Effect } from "effect"
import { Expand, ObjectStepsInputTuple, TupleMapObjectStepsReturn, ObjectStepsDeps, ObjectStepsErrors, ChainObjectStepsReturn, chainObjectStepsProg, tupleMapObjectStepsProg } from "./object_builders.ts"

// business logic is encapsulated in a pure function
//   (in: extends Object) => [...(extends Object)[]]
// a (chain of) effectful input steps build the in: Object, and 
// a (chain of) effectful output steps process the output tuple

// so chain has:
// [(Input) => Effect<R,E,PureInput>,
//  (PureInput) => PureOutput,
//  (PureOutput) => Effect<R,E,Output>]

// but that's too abstract ... we are going to use the object_builders for
// the input and output chains...
//
// Input is an Object with a tag: ,
// input steps extend the Input Object
// the PureInput is the accumulation of the Input with all the input steps
// the tag: is used to associate the PureOutput on the Object
// output steps extend the Input Object
// the result is the accumulation of the PureInput with the PureOutput and
// all the output steps

export interface Tagged { readonly tag: string }
export type Tag<T extends Tagged> = { readonly tag: T['tag'] }

// build a tag value for an Tagged type,
// forcing the tag param to match the Tagged.tag string
// const aTag = tag<ATagged>("ATagged")
export const tag = <T extends Tagged>(tag: T['tag']): Tag<T> => { return { tag } }

// maybe we have different sorts of steps
// - input service-fn steps - chain steps
// - pure-step - in:obj -> out:tuple
// - output service-fn steps - tuple-map steps

// no type parameters so easier to use than FxFn
type EffectFn = (i: any) => Effect.Effect<any, any, any>
type ObjectObjectEffectFn<I> = (i: I) => Effect.Effect<any, any, object>
type TupleObjectEffectFn = (i: readonly [...object[]]) => Effect.Effect<any, any, object>

type EffectFnValue<T extends EffectFn> = ReturnType<T> extends Effect.Effect<infer _R, infer _E, infer V>
    ? V 
    : never

// wrap a pure fn with an effectful input and effectful output.
// the pure fn takes an input constrained to be the same as the 
// output value of the InputFn, and returns an tuple output, constrained to 
// be the same as the input of the OutputFn
export function wrapPure<I extends Tagged>() {
    return function <InputEffectFn extends ObjectObjectEffectFn<I>,
        PureFn extends (pi: EffectFnValue<InputEffectFn>) => Parameters<OutputEffectFn>[0],
        OutputEffectFn extends TupleObjectEffectFn>
        (inputEffectFn: InputEffectFn, pureFn: PureFn, outputEffectFn: OutputEffectFn) {

        const r = (i: I) => {
            return Effect.gen(function* (_) {
                const pi = yield* _(inputEffectFn(i))
                const po = pureFn(pi as any)
                const oo = yield* _(outputEffectFn(po))

                const v = {
                    ...pi,
                    [i.tag]: po,
                    ...oo
                }
                return v
            })
        }

        return r as (i: Parameters<InputEffectFn>[0]) => Effect.Effect<any, any, object>
    }
}


// wrap a pure fn with effectful inputs and outputs defined by chains of ObjectStepSpecs
export function wrapPureChain<I extends Tagged>() {
    return function <InputStepSpecs extends readonly [...any[]],
        OutputStepSpecs extends readonly [...any[]]>
        (inputStepSpecs: InputStepSpecs,
            pureFn: (pi: ChainObjectStepsReturn<InputStepSpecs, I>) => ObjectStepsInputTuple<OutputStepSpecs>,
            outputStepSpecs: OutputStepSpecs) {
        
        console.log("CREATE PURE_FN_CHAIN", inputStepSpecs, pureFn, outputStepSpecs)
        const inputChainProg = chainObjectStepsProg<I>()(inputStepSpecs)
        const outputStepsProg = tupleMapObjectStepsProg<ObjectStepsInputTuple<OutputStepSpecs>>()(outputStepSpecs)

        const r = (i: I) => {
            console.log("RUN PURE_FN_CHAIN: i", i)
            return Effect.gen(function* (_) {
                const pi: any = yield* _(inputChainProg(i))
                console.log("RUN PURE_FN_CHAIN: pi", pi)
                const po = pureFn(pi)
                console.log("RUN PURE_FN_CHAIN: po", po)
                const oo = yield* _(outputStepsProg(po)) 
                console.log("RUN PURE_FN_CHAIN: oo", oo)
                const v = { ...pi, [i.tag]: po , ...oo }
                console.log("RUN PURE_FN_CHAIN: v", v)
                return v
            })
        }

        return r as (i: I) => Effect.Effect<ObjectStepsDeps<InputStepSpecs> | ObjectStepsDeps<OutputStepSpecs>,
            ObjectStepsErrors<InputStepSpecs> | ObjectStepsErrors<OutputStepSpecs>,
            Expand<ChainObjectStepsReturn<InputStepSpecs, I> &
            { [_K in I['tag']]: ObjectStepsInputTuple<OutputStepSpecs> } &
            TupleMapObjectStepsReturn<OutputStepSpecs, ObjectStepsInputTuple<OutputStepSpecs>>>>
    }
}
