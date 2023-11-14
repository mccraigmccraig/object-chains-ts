// deno-lint-ignore-file no-explicit-any
import { Effect } from "effect"
import { UFxFnDeps, UFxFnErrors, UFxFnValue } from "./fx_fn.ts"
import { Expand, UnionFromTuple, UObjectStepSpec, ObjectStepsInputTuple, TupleMapObjectStepsReturn, ObjectStepsDepsU, ObjectStepsErrorsU, ChainObjectStepsReturn, chainObjectStepsProg, tupleMapObjectStepsProg } from "./object_builders.ts"

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
type ObjectObjectEffectFn<I extends object, V extends object> = (i: I) => Effect.Effect<any, any, V>
type AnyObjectEffectFn<I> = (i: I) => Effect.Effect<any, any, object>

// wrap a pure fn with an effectful input and effectful output.
// the pure fn takes an input constrained to be the same as the 
// output value of the InputFn, and returns an tuple output, constrained to 
// be the same as the input of the OutputFn
export function wrapPure<I extends Tagged>() {
    return function <InputEffectFn extends ObjectObjectEffectFn<I, Parameters<PureFn>[0]>,
        PureFn extends (pi: any) => any,
        OutputEffectFn extends AnyObjectEffectFn<ReturnType<PureFn>>>
        (inputEffectFn: InputEffectFn, pureFn: PureFn, outputEffectFn: OutputEffectFn) {

        const r = (i: I) => {
            return Effect.gen(function* (_) {
                console.log("WRAP PURE: i", i)
                const pi = yield* _(inputEffectFn(i))
                console.log("WRAP PURE: pi", pi)
                const po = pureFn(pi as any)
                console.log("WRAP PURE: po", po)
                const oo = yield* _(outputEffectFn(po))

                const v = {
                    ...pi,
                    [i.tag]: po,
                    ...oo
                }
                console.log("WRAP PURE: v", v)
                return v
            })
        }

        return r as (i: I) => Effect.Effect<UFxFnDeps<InputEffectFn> | UFxFnDeps<OutputEffectFn>,
            UFxFnErrors<InputEffectFn> | UFxFnErrors<OutputEffectFn>,
            Expand<UFxFnValue<InputEffectFn> &
                { [_K in I['tag']]: ReturnType<PureFn> } &
                UFxFnValue<OutputEffectFn>>>
    }
}

// a way to get at the tag strings from the PureWrapperProgram without
// inferring the step and program types
export type UPureWrapperProgramBase<T> = {
    readonly tagStr: T
    readonly program: (i: any) => Effect.Effect<any, any, any>
    readonly [index: string]: any
}

// a generic, but fully parameterised, type for arrays
export type UPureWrapperProgram = UPureWrapperProgramBase<string>

// a data structure with the program for handling handling events of a type identified by the tag
// open to extension with additional explanatory keys
export type PureWrapperProgram
    <I extends Tagged,
        InputEffectFn extends ObjectObjectEffectFn<I, Parameters<PureFn>[0]>,
        PureFn extends (pi: any) => any,
        OutputEffectFn extends AnyObjectEffectFn<ReturnType<PureFn>>> = {
            tagStr: Tag<I>['tag']
            tag: Tag<I>
            pureFn: (pi: any) => any
            program: (i: I) => Effect.Effect<UFxFnDeps<InputEffectFn> | UFxFnDeps<OutputEffectFn>,
                UFxFnErrors<InputEffectFn> | UFxFnErrors<OutputEffectFn>,
                Expand<UFxFnValue<InputEffectFn> &
                    { [_K in I['tag']]: ReturnType<PureFn> } &
                    UFxFnValue<OutputEffectFn>>>

            [index: string]: any
        }

export type PureWrapperProgramInput<T> = T extends PureWrapperProgram<infer I, infer _IFxFn, infer _PFn, infer _OFxFn> ? I : never
export type PureWrapperProgramsInputTuple<Tuple extends [...UPureWrapperProgram[]]> = {
    [Index in keyof Tuple]: PureWrapperProgramInput<Tuple[Index]>
} & { length: Tuple['length'] }

export type PureWrapperProgramTag<T> = T extends PureWrapperProgram<infer _I, infer _IFxFn, infer _PFn, infer _OFxFn> ? T['eventTag'] : never
export type PureWrapperProgramsTagTuple<Tuple extends [...UPureWrapperProgram[]]> = {
    [Index in keyof Tuple]: PureWrapperProgramTag<Tuple[Index]>
} & { length: Tuple['length'] }

export type PureWrapperProgramOutputEffect<T> = T extends PureWrapperProgram<infer _I, infer _IFxFn, infer _PFn, infer OFxFn> ? ReturnType<OFxFn> : never

export type PureWrapperProgramDeps<T> = PureWrapperProgramOutputEffect<T> extends Effect.Effect<infer R, infer _E, infer _V> ? R : never
export type PureWrapperProgramsDepsU<Tuple extends [...UPureWrapperProgram[]]> = UnionFromTuple<{
    [Index in keyof Tuple]: PureWrapperProgramDeps<Tuple[Index]>
} & { length: Tuple['length'] }>

export type PureWrapperProgramErrors<T> = PureWrapperProgramOutputEffect<T> extends Effect.Effect<infer _R, infer E, infer _V> ? E : never
export type PureWrapperProgramsErrorsU<Tuple extends [...UPureWrapperProgram[]]> = UnionFromTuple<{
    [Index in keyof Tuple]: PureWrapperProgramErrors<Tuple[Index]>
} & { length: Tuple['length'] }>

// make a PureWrapperProgram
export function pureWrapperProgram<I extends Tagged>() {
    return function <InputEffectFn extends ObjectObjectEffectFn<I, Parameters<PureFn>[0]>,
        PureFn extends (pi: any) => any,
        OutputEffectFn extends AnyObjectEffectFn<ReturnType<PureFn>>>
        (tag: Tag<I>,
            inputEffectFn: InputEffectFn,
            pureFn: PureFn,
            outputEffectFn: OutputEffectFn)
        : PureWrapperProgram<I, InputEffectFn, PureFn, OutputEffectFn> {
        return {
            tagStr: tag.tag,
            tag: tag,
            pureFn: pureFn,
            program: wrapPure<I>()(inputEffectFn, pureFn, outputEffectFn)
        }
    }
}

// wrap a pure fn with effectful inputs and outputs defined by chains of ObjectStepSpecs
export function wrapPureChain<I extends Tagged>() {
    return function <InputStepSpecs extends readonly [...UObjectStepSpec[]],
        OutputStepSpecs extends readonly [...UObjectStepSpec[]]>
        (inputStepSpecs: InputStepSpecs,
            pureFn: (pi: ChainObjectStepsReturn<InputStepSpecs, I>) => ObjectStepsInputTuple<OutputStepSpecs>,
            outputStepSpecs: OutputStepSpecs) {

        console.log("CREATE WRAP_PURE_CHAIN", inputStepSpecs, pureFn, outputStepSpecs)
        const inputChainProg = chainObjectStepsProg<I>()(inputStepSpecs as any)
        const outputStepsProg = tupleMapObjectStepsProg<ObjectStepsInputTuple<OutputStepSpecs>>()(outputStepSpecs as any)

        const r = wrapPure<I>()(inputChainProg as any, pureFn as any, outputStepsProg as any)

        return r as (i: I) => Effect.Effect<ObjectStepsDepsU<InputStepSpecs> | ObjectStepsDepsU<OutputStepSpecs>,
            ObjectStepsErrorsU<InputStepSpecs> | ObjectStepsErrorsU<OutputStepSpecs>,
            Expand<ChainObjectStepsReturn<InputStepSpecs, I> &
                { [_K in I['tag']]: ObjectStepsInputTuple<OutputStepSpecs> } &
                TupleMapObjectStepsReturn<OutputStepSpecs, ObjectStepsInputTuple<OutputStepSpecs>>>>
    }
}

// make a PureWrapperProgram with wrapPureChain
export function pureWrapperChainProgram<I extends Tagged>() {
    return function <InputStepSpecs extends readonly [...UObjectStepSpec[]],
        OutputStepSpecs extends readonly [...UObjectStepSpec[]]>
        (tag: Tag<I>,
            inputStepSpecs: InputStepSpecs,
            pureFn: (pi: ChainObjectStepsReturn<InputStepSpecs, I>) => ObjectStepsInputTuple<OutputStepSpecs>,
            outputStepSpecs: OutputStepSpecs) {

        return {
            tagStr: tag.tag,
            tag: tag,
            pureFn: pureFn,
            program: wrapPureChain<I>()(inputStepSpecs, pureFn, outputStepSpecs),
            inputStepSpecs: inputStepSpecs,
            outputStepSpecs: outputStepSpecs
        }
    }
}
