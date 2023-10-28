// deno-lint-ignore-file no-explicit-any
import { Effect, Context } from "effect"

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

////////////////////////////////////////////
////////////////// Events //////////////////
////////////////////////////////////////////

// an Event has a tag to identify a handler
export interface EventI {
    tag: string
}

// a simple tag type for events
export interface EventTag<EV extends EventI> {
    readonly tag: EV['tag'] // a string name for the type
}

// build a tag value for an EventType
// type forces the tag param to match the Event tag string
// const aTag = eventTag<AnEvent>("AnEvent")
export const eventTag = <EV extends EventI>(tag: EV['tag']): EventTag<EV> => {
    return {
        tag
    }
}

////////////////////////////////////////////
////////////////////////////////////////////
////////////////////////////////////////////


// utility type to get a Union from a Tuple of types
type UnionFromTuple<Tuple extends any[]> = Tuple[number]

// attempts at a utility type to explicitly expand a tuple type 
// for better IntelliSense in the style of:
// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type
// unfortunately, 
// - the first does nothing,
// - the second expands to unknown[],
// - the third also expands to unknown[]
// but leaving these attempts here to revisit...
// 
// type Expand<Tuple extends [...any[]]> = {
//     [Index in keyof Tuple]: Tuple[Index]
// } 
// type Expand<T> = T extends [...infer Tuple] ? {[Index in keyof Tuple]: Tuple[Index]} : never
// type Expand<T> = T extends [...infer Tuple] ? [...Tuple] : never

// attempt at a utility type to explicitly expand a tuple type ... used
// for more readable IntelliSense outputs after complex extractions
// export type Expand<T> = T extends [...infer O] ? { [K in keyof O]: O[K] } : never;

// an FxService is an effectful service with an .fx method
// which is given an optional argument of type D to return 
// a value of type V. it depends on services R and can error E
// cf: re-frame effect/coeffect handlers
export interface FxService<EV extends EventI, V, D = undefined, R = never, E = never> {
    readonly fx: {
        (ev: EV, arg: D): Effect.Effect<R, E, V>
    }
}
export type FxServiceTag<EV extends EventI, V, D = undefined, R = never, E = never> = Context.Tag<any, FxService<EV, V, D, R, E>>

// allow steps to be defined with data or with just an FxServiceTag
export type CompactStepSpec<EV extends EventI, V, R = never, E = never> = FxServiceTag<EV, V, undefined, R, E>
export type ObjectStepSpec<EV extends EventI, V, D = undefined, R = never, E = never> = {
    fxServiceTag: FxServiceTag<EV, V, D, R, E>
    data: D
}
export type StepSpec<EV extends EventI, V, D = undefined, R = never, E = never> = CompactStepSpec<EV, V, R, E> | ObjectStepSpec<EV, V, D, R, E>

// there is something wrong with this fn ... using it to build ObjectStepSpec objects
// causes type errors, whereas literal ObjectStepSpec objects check fine
export const step = <EV extends EventI, V, D = undefined, R = never, E = never>(fxServiceTag: FxServiceTag<EV, V, D, R, E>, data: D): ObjectStepSpec<EV, V, D, R, E> => {
    return {
        "fxServiceTag": fxServiceTag,
        "data": data
    }
}

// extract a Context.Tag from a StepSpec
export type ExtractContextTag<T> = T extends Context.Tag<infer _I, infer _S> ? T :
    T extends ObjectStepSpec<infer _EV, infer _V, infer _D, infer _R, infer _E> ? T["fxServiceTag"] :
    never

// utility types to extract the Service Id type from a StepSpec
type ExtractTagIdType<T> = ExtractContextTag<T> extends Context.Tag<infer I, infer S> ? I : never
type ExtractTagIdTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractTagIdType<Tuple[Index]>
} & { length: Tuple['length'] }

// extract an FxServiceTag from a StepSpec
export type ExtractFxServiceTag<T> = T extends FxServiceTag<infer _EV, infer _V, infer _D, infer _R, infer _E> ? T :
    T extends ObjectStepSpec<infer EV, infer _V, infer _D, infer _R, infer _E> ? T["fxServiceTag"] :
    never

// extract a tuple of value types from a tuple of StepSpecs
export type ExtractValueType<T> = ExtractFxServiceTag<T> extends FxServiceTag<infer _EV, infer V, infer _D, infer _R, infer _E> ? V : never
type ExtractValueTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractValueType<Tuple[Index]>
} & { length: Tuple['length'] }
type ExtractArgType<T> = ExtractFxServiceTag<T> extends FxServiceTag<infer _EV, infer _V, infer D, infer _R, infer _E> ? D : never
type ExtractArgTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractArgType<Tuple[Index]>
} & { length: Tuple['length'] }
type ExtractErrorType<T> = ExtractFxServiceTag<T> extends FxServiceTag<infer _EV, infer _I, infer _D, infer _R, infer E> ? E : never
type ExtractErrorTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractErrorType<Tuple[Index]>
} & { length: Tuple['length'] }


// do a single effectful step - fetch the FxService named by the tag and 
// give it data to resolve a value
// 
// - adds the service referred to by the FxServiceTag into the Effect context
function bindStepEffect<EV extends EventI, V, D, R, E>
    (ev: EV, stepSpec: StepSpec<EV, V, D, R, E>)
    : Effect.Effect<R | ExtractTagIdType<StepSpec<EV, V, D, R, E>>, E, V> {

    return Effect.gen(function* (_) {
        if ((typeof stepSpec == 'object') && ("fxServiceTag" in stepSpec)) {
            const s = yield* _(stepSpec.fxServiceTag)
            const v = yield* _(s.fx(ev, stepSpec.data))
            return v
        } else {
            const s = yield* _(stepSpec)
            const v = yield* _(s.fx(ev, undefined))
            return v
        }
    })
}

// given an EV returns a function which binds a step
function bindStepEffectFn<EV extends EventI, V, D, R, E>
    (ev: EV)
    : (stepSpec: StepSpec<EV, V, D, R, E>) => Effect.Effect<R | ExtractTagIdType<StepSpec<EV, V, D, R, E>>, E, V> {

    return (stepSpec: StepSpec<EV, V, D, R, E>): Effect.Effect<R | ExtractTagIdType<StepSpec<EV, V, D, R, E>>, E, V> => {

        return bindStepEffect(ev, stepSpec);
    }
}

// makeEventHandlerProgram creates a program which uses the InputServices to gather the
// inputs to the handler and the OutputServices to process the outputs from the handler.
// the resulting program has all the dependent services in the Effect context 
// type
export const makeEventHandlerProgram =
    <EV extends EventI,
        InputStepSpecs extends [...any[]],
        OutputStepSpecs extends [...any[]]>
        (inputStepSpecs: [...InputStepSpecs],
            // the pureHandler is a pure fn which processes simple input data into simple output data
            // cf: re-frame event-handlers
            pureHandler: (ev: EV, ...vals: ExtractValueTypes<InputStepSpecs>) => ExtractArgTypes<OutputStepSpecs>,
            outputStepSpecs: [...OutputStepSpecs])
        : (ev: EV) => Effect.Effect<UnionFromTuple<ExtractTagIdTypes<InputStepSpecs>> |
            UnionFromTuple<ExtractTagIdTypes<OutputStepSpecs>>,

            UnionFromTuple<ExtractErrorTypes<InputStepSpecs>> |
            UnionFromTuple<ExtractErrorTypes<OutputStepSpecs>>,

            ExtractValueTypes<OutputStepSpecs>> => {

        // no type-safety in the function body ... i don't think we can type it 
        // properly without existential types, which ain't a typescript thing (yet)

        const outputsEffect = (ev: EV) => {
            // this fn feeds EV to each step
            const bindFn = bindStepEffectFn(ev)

            // first use the inputStepSpecs to resolve the inputs
            const inputEffects = inputStepSpecs.map(bindFn)
            const inputsEffect = inputEffects.reduce(
                (accEff, vEff) => Effect.gen(function* (_) {
                    const vals = (yield* _(accEff)) as any[]
                    const v = (yield* _(vEff))
                    vals.push(v)
                    return vals
                }),
                Effect.succeed([]))

            return Effect.gen(function* (_) {
                const inputData = (yield* _(inputsEffect)) as ExtractValueTypes<InputStepSpecs>

                // @ts-ignore call the pure handler
                const outputData = pureHandler.call(undefined, ev, ...inputData)

                const outputDataZipFxSvcTags: any[] = outputData.map((od, i) => [od, outputStepSpecs[i]])

                // now give the outputData to the outputEffects to resolve the outputs
                const outputsEffect = outputDataZipFxSvcTags.reduce(
                    (accEff, [od, fxSvcTag]) => Effect.gen(function* (_) {
                        const vals = (yield* _(accEff)) as any[]
                        const oospec = { fxServiceTag: fxSvcTag, data: od }
                        const ov = yield* _(bindFn(oospec))
                        vals.push(ov)
                        return vals
                    }),
                    Effect.succeed([]))

                const outputs = yield* _(outputsEffect)
                return outputs
            })
        }

        return outputsEffect as (ev: EV) => Effect.Effect<UnionFromTuple<ExtractTagIdTypes<InputStepSpecs>> |
            UnionFromTuple<ExtractTagIdTypes<OutputStepSpecs>>,

            UnionFromTuple<ExtractErrorTypes<InputStepSpecs>> |
            UnionFromTuple<ExtractErrorTypes<OutputStepSpecs>>,

            ExtractValueTypes<OutputStepSpecs>>
    }


// maybe want a way to get the tags from the EventHandlerPrograms without
// going through generic inference
export type EventHandlerProgramBase<T> = {
    eventTagStr: T
    program: (ev: any) => any // 🤮
}

// a data structure with the specification and program for 
// handling events of a type identified by the Event tag
export type  EventHandlerProgram
    <EV extends EventI,
        InputStepSpecs extends [...any[]],
        OutputStepSpecs extends [...any[]]> =  {
    eventTagStr: EventTag<EV>['tag']
    eventTag: EventTag<EV>
    inputSteps: [...InputStepSpecs]
    pureHandler: (ev: EV, ...vals: ExtractValueTypes<InputStepSpecs>) => ExtractArgTypes<OutputStepSpecs>
    outputSteps: [...OutputStepSpecs]
    program: (ev: EV) => Effect.Effect<UnionFromTuple<ExtractTagIdTypes<InputStepSpecs>> |
        UnionFromTuple<ExtractTagIdTypes<OutputStepSpecs>>,

        UnionFromTuple<ExtractErrorTypes<InputStepSpecs>> |
        UnionFromTuple<ExtractErrorTypes<OutputStepSpecs>>,

        ExtractValueTypes<OutputStepSpecs>>
}


export const buildEventHandlerProgram =
    <EV extends EventI,
        InputStepSpecs extends [...any[]],
        OutputStepSpecs extends [...any[]]>
        (eventTag: EventTag<EV>,
            inputSteps: [...InputStepSpecs],
            pureHandler: (ev: EV, ...vals: ExtractValueTypes<InputStepSpecs>) => ExtractArgTypes<OutputStepSpecs>,
            outputSteps: [...OutputStepSpecs])
        : EventHandlerProgram<EV, InputStepSpecs, OutputStepSpecs> => {

        return {
            eventTagStr: eventTag.tag,
            eventTag,
            inputSteps,
            pureHandler,
            outputSteps,
            program: makeEventHandlerProgram<EV, InputStepSpecs, OutputStepSpecs>(inputSteps, pureHandler, outputSteps)
        }
    }

// takes a list of EventHandlerPrograms and builds a new program which handles any of the events
// handled by the individual programs
// {
//   // get output types for any tag
//   eventPrograms: {eventTag: program}
//   program: (ev) => Effect...  
// }
//  the event type input to the program will be the union of all the handled event types,
// while the Effect types will be chosen based on the type of the event - basically the type 
// of the individual handler program for that event
// 
// maybe want a MultiEventHandlerProgram type capturing the above ... and
// which would be composable
//
// the returned program will have type:
// Effect<union-of-requirements-of-programs,
//        union-of-errors-of-programs,
//        union-of-output-types-of-programs>

export type ExtractProgramEventType<T> = T extends EventHandlerProgram<infer EV, infer _ISS, infer _OSS> ? EV : never
export type ExtractProgramEventTypes<Tuple extends [...EventHandlerProgramBase<string>[]]> = {
    [Index in keyof Tuple]: ExtractProgramEventType<Tuple[Index]>
} & { length: Tuple['length'] }

export type ExtractProgramEventTag<T> = T extends EventHandlerProgram<infer _EV, infer _ISS, infer _OSS> ? T['eventTag'] : never
export type ExtractProgramEventTags<Tuple extends [...EventHandlerProgramBase<string>[]]> = {
    [Index in keyof Tuple]: ExtractProgramEventTag<Tuple[Index]>
} & { length: Tuple['length'] }

export type ExtractProgramOutputEffect<T> = T extends EventHandlerProgram<infer _EV, infer _ISS, infer _OSS> ? ReturnType<T['program']> : never



// this indexes a tuple by the element's eventTagStr property
// https://stackoverflow.com/questions/54599480/typescript-tuple-type-to-object-type  
export type IndexEventHandlerProgramTuple<T extends Array<EventHandlerProgramBase<string>>> = {
    [K in T[number]['eventTagStr']]: Extract<T[number], { eventTagStr: K }>
}
// showing that this does index ta tuple of EventHandlerPrograms
export type X = IndexEventHandlerProgramTuple<[{ eventTagStr: "foo", id: 10, program: (ev: any) => null },
    { eventTagStr: "bar", id: 200, program: (ev: any) => null }]>

// a bit tricky ... given a union of EventI, and a list of EventHandlerPrograms, get the 
// return type for the handler function, which is the return type of the program
// whose tag matches the event

// use a conditional type to distribute the result type over a union of EventIs
export type DistributeEventResultTypes<EVU extends any, PROGS extends [...EventHandlerProgramBase<string>[]]> =
    EVU extends EventI ?
    IndexEventHandlerProgramTuple<PROGS>[EVU['tag']] extends EventHandlerProgram<infer _EV, infer _ISS, infer _OSS> ?
    ReturnType<IndexEventHandlerProgramTuple<PROGS>[EVU['tag']]['program']> :
    never : never

// return a function of the union 
// of all the Event types handled by the supplied EventHandlerPrograms,
// which uses a supplied EventHandlerProgram to handle the Event,
// returning the same results as the supplied EventHandlerProgram
export const makeMultiEventHandlerProgram =
    <EventHandlerPrograms extends [...EventHandlerProgramBase<string>[]],
        EVU extends UnionFromTuple<ExtractProgramEventTypes<EventHandlerPrograms>>>
        (eventHandlerPrograms: [...EventHandlerPrograms]):
        (ev: EVU) => DistributeEventResultTypes<EVU, EventHandlerPrograms> => {

        const progsByEventTag = eventHandlerPrograms.reduce(
            (m, p) => { m[p.eventTagStr] = p; return m },
            {} as { [index: string]: EventHandlerProgramBase<string> })

        return (ev: EVU) => {
            const prog = progsByEventTag[ev.tag]
            if (prog != undefined) {
                // so prog.program should be the resolved EventHandlerProgram - but 
                // the type is dependent on the actual type of the ev
                console.log("multiProg: ", ev)
                return prog.program(ev) as DistributeEventResultTypes<EVU, EventHandlerPrograms>
            } else
                throw "NoProgram for Event tag: " + ev.tag
        }
    }



// what next...
// - improving the steps pipeline to support an object of step-values
//     each step defining a [key, service, param-fn(v: obj-so-far)=>service-param],
//     and the first step getting something like {event: <event>}
// - an event-handler Service allowing recursion
// - automatic logging and tracing at each step

// combine individual handler programs
// export const combineEventPrograms = <T>(): any => {}




// e.g.
export type User = {
    id: string
    name: string
}

// an Event specifying an UpdateUserEvent
export interface UpdateUserEvent extends EventI {
    tag: "UpdateUserEvent"
    user: User
}

export const UpdateUserEventTag = eventTag<UpdateUserEvent>("UpdateUserEvent")
export const s = UpdateUserEventTag.tag


// each event handler program has its own R,E,V ... we don't
// have existential types so we'll have to build the global effect
// types with conditionals
//export type EventHandlerProgram<R, E, V> = Effect.Effect<R, E, V>

// a mapping between EventI tags and handler programs
// can we type the output of the global handler based on the tag of the input Event ?
export interface EventHandlers {
    [index: string]: any extends EventHandlerProgram<infer R, infer E, infer V> ? EventHandlerProgram<R, E, V> : never
}

