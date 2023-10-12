// deno-lint-ignore-file no-explicit-any
import { Effect, Context } from "npm:effect@^2.0.0-next.34"

// the program can be constructed from lists of input tags, then the pure handler and
// a list of output tags
//
// so handleEventProgram([GetUserEvInputService, 
//                        AuthenticatedUserInputService, 
//                        UserInputService],
//                       pureHandlerFn,
//                       [GetUserLogEntryOutputService, 
//                        UserResponseOutputService])
// 
// so we have effectful input-services, a pure handler which takes simple-data params and returns a
// list of simple-data output descriptions, and effectful output-services which have data params
// which match the data types output from the pure-handler

// utility type to get a Union from a Tuple of types
type UnionFromTuple<Tuple extends any[]> = Tuple[number]

// an FxService is an effectful service with an .fx method
// which is given an optional argument of type D to return 
// a value of type V. it depends on services R and can error E
// cf: re-frame effect/coeffect handlers
export interface FxService<V, D = undefined, R = never, E = never> {
    readonly fx: {
        (arg: D): Effect.Effect<R, E, V>
    }
}
export type FxServiceTag<V, D = undefined, R = never, E = never> = Context.Tag<any, FxService<V, D, R, E>>

// allow steps to be defined with data or with just an FxServiceTag
export type CompactStepSpec<V, R = never, E = never> = FxServiceTag<V, undefined, R, E>
export type ObjectStepSpec<V, D = undefined, R = never, E = never> = {
    fxServiceTag: FxServiceTag<V, D, R, E>
    data: D
}
export type StepSpec<V, D = undefined, R = never, E = never> = CompactStepSpec<V, R, E> | ObjectStepSpec<V, D, R, E>

// there is something wrong with this fn ... using it to build ObjectStepSpec objects
// causes type errors, whereas literal ObjectStepSpec objects check fine
export const step = <V, D = undefined, R = never, E = never>(fxServiceTag: FxServiceTag<V, D, R, E>, data: D): ObjectStepSpec<V, D, R, E> => {
    return {
        "fxServiceTag": fxServiceTag,
        "data": data
    }
}

// extract a Context.Tag from a StepSpec
export type ExtractContextTag<T> = T extends Context.Tag<infer _I, infer _S> ? T :
    T extends ObjectStepSpec<infer _V, infer _D, infer _R, infer _E> ? T["fxServiceTag"] :
    never

// utility types to extract the Service Id type from a StepSpec
type ExtractTagIdType<T> = ExtractContextTag<T> extends Context.Tag<infer I, infer S> ? I : never
type ExtractTagIdTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractTagIdType<Tuple[Index]>
} & { length: Tuple['length'] }

// extract an FxServiceTag from a StepSpec
export type ExtractFxServiceTag<T> = T extends FxServiceTag<infer _V, infer _D, infer _R, infer _E> ? T :
    T extends ObjectStepSpec<infer _V, infer _D, infer _R, infer _E> ? T["fxServiceTag"] :
    never

// extract a tuple of value types from a tuple of StepSpecs
export type ExtractValueType<T> = ExtractFxServiceTag<T> extends FxServiceTag<infer V, infer _D, infer _R, infer _E> ? V : never
type ExtractValueTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractValueType<Tuple[Index]>
} & { length: Tuple['length'] }
type ExtractArgType<T> = ExtractFxServiceTag<T> extends FxServiceTag<infer _V, infer D, infer _R, infer _E> ? D : never
type ExtractArgTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractArgType<Tuple[Index]>
} & { length: Tuple['length'] }
type ExtractErrorType<T> = ExtractFxServiceTag<T> extends FxServiceTag<infer _I, infer _D, infer _R, infer E> ? E : never
type ExtractErrorTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractErrorType<Tuple[Index]>
} & { length: Tuple['length'] }


// do a single effectful step - fetch the FxService named by the tag and 
// give it data to resolve a value
// 
// - adds the service referred to by the FxServiceTag into the Effect context
function bindStepEffect<V, D, R, E>
    (stepSpec: StepSpec<V, D, R, E>)
    : Effect.Effect<R | ExtractTagIdType<StepSpec<V, D, R, E>>, E, V> {

    return Effect.gen(function* (_) {
        if ((typeof stepSpec == 'object') && ("fxServiceTag" in stepSpec)) {
            const s = yield* _(stepSpec.fxServiceTag)
            const v = yield* _(s.fx(stepSpec.data))
            return v
        } else {
            const s = yield* _(stepSpec)
            const v = yield* _(s.fx(undefined))
            return v
        }
    })
}

// createProgram builds a program which uses the InputServices to gather the
// inputs to the handler and the OutputServices to process the outputs from the handler.
// the resulting program has all the dependent services in the Effect context 
// type
export const handleEventProgram =
    <InputStepSpecs extends any[], OutputStepSpecs extends any[]>
        (inputStepSpecs: [...InputStepSpecs],
            // the pureHandler is a pure fn which processes simple input data into simple output data
            // cf: re-frame event-handlers
            pureHandler: (...vals: ExtractValueTypes<InputStepSpecs>) => ExtractArgTypes<OutputStepSpecs>,
            outputStepSpecs: [...OutputStepSpecs])
        : Effect.Effect<UnionFromTuple<ExtractTagIdTypes<InputStepSpecs>> |
            UnionFromTuple<ExtractTagIdTypes<OutputStepSpecs>>,

            UnionFromTuple<ExtractErrorTypes<InputStepSpecs>> |
            UnionFromTuple<ExtractErrorTypes<OutputStepSpecs>>,

            ExtractValueTypes<OutputStepSpecs>> => {

        // no type-safety in the function body ... i don't think we can type it 
        // properly without existential types, which ain't a typescript thing (yet)

        // first use the inputStepSpecs to resolve the inputs
        const inputEffects = inputStepSpecs.map(bindStepEffect)
        const inputsEffect = inputEffects.reduce(
            (accEff, vEff) => Effect.gen(function* (_) {
                const vals = (yield* _(accEff)) as any[]
                const v = (yield* _(vEff))
                vals.push(v)
                return vals
            }),
            Effect.succeed([]))

        const outputsEffect = Effect.gen(function* (_) {
            const inputData = (yield* _(inputsEffect)) as ExtractValueTypes<InputStepSpecs>

            // call the pure handler
            const outputData = pureHandler.apply(undefined, inputData)

            const outputDataZipFxSvcTags: any[] = outputData.map((od, i) => [od, outputStepSpecs[i]])

            // now give the outputData to the outputEffects to resolve the outputs
            const outputsEffect = outputDataZipFxSvcTags.reduce(
                (accEff, [od, fxSvcTag]) => Effect.gen(function* (_) {
                    const vals = (yield* _(accEff)) as any[]
                    const oospec = { fxServiceTag: fxSvcTag, data: od }
                    const ov = yield* _(bindStepEffect(oospec))
                    vals.push(ov)
                    return vals
                }),
                Effect.succeed([]))

            const outputs = yield* _(outputsEffect)
            return outputs
        })

        return outputsEffect as Effect.Effect<UnionFromTuple<ExtractTagIdTypes<InputStepSpecs>> |
            UnionFromTuple<ExtractTagIdTypes<OutputStepSpecs>>,

            UnionFromTuple<ExtractErrorTypes<InputStepSpecs>> |
            UnionFromTuple<ExtractErrorTypes<OutputStepSpecs>>,

            ExtractValueTypes<OutputStepSpecs>>
    }


// what next...
// - combining individual event-handler chains into a program
// - an event-handler Service allowing recursion
// - automatic logging and tracing at each step

// combine individual handler programs
// export const combineEventPrograms = <T>(): any => {}

