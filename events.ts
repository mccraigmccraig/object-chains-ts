// deno-lint-ignore-file no-explicit-any
import { Effect, Console, Context, Brand } from "npm:effect@^2.0.0-next.30";

// the program can be constructed from lists of input tags, then the pure handler and
// a list of output tags
//
// so createHandlerProgram([GetUserEvInputService, 
//                          AuthenticatedUserInputService, 
//                          UserInputService],
//                         pureHandlerFn,
//                         [GetUserLogEntryOutputService, 
//                          UserResponseOutputService])
// 
// so we have effectful input-services, a pure handler which takes simple-data params and returns a
// list of simple-data output descriptions, and effectful output-services which have data params
// which match the data types output from the pure-handler
// 

// utility type to get a Union from a Tuple of types
export type UnionFromTuple<Tuple extends any[]> = Tuple[number];

// utility types to extract the Service type from a Context.Tag
export type ExtractServiceType<T> = T extends Context.Tag<infer _I, infer S> ? S : never;
export type ExtractServiceTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractServiceType<Tuple[Index]>
} & {length: Tuple['length']}

// an InputService is an effectful service with an .input method
// which is given an 
// optional paramater D to fetch some simple data I
// cf: re-frame coeffect handlers
export interface InputService<I,R=never,E=never,D=undefined> {
    readonly input: (arg?: D) => Effect.Effect<R,E,I>
}

export type InputServiceTag<I,R=never,E=never,D=undefined> = Context.Tag<InputService<I,R,E,D>, InputService<I,R,E,D>> 
// extract a tuple of input types from a tuple of InputService Context.Tags
export type ExtractInputType<T> = T extends InputServiceTag<infer I,infer _R, infer _E, infer _D> ? I : never;
export type ExtractInputTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractInputType<Tuple[Index]>
} & {length: Tuple['length']}


export type ExtractInputError<T> = T extends InputServiceTag<infer _I,infer _R, infer E, infer _D> ? E : never;
export type ExtractInputErrors<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractInputError<Tuple[Index]>
} & {length: Tuple['length']}



// an OutputService is an effectful service with an .output method
// which outputs some simple data O
// cf: re-frame effect handlers
export interface OutputService<O,R=never,E=never,RET=undefined> {
    readonly output: (arg: O) => Effect.Effect<R,E,never>
}
export type OutputServiceTag<O,R=never,E=never,RET=undefined> = Context.Tag<OutputService<O,R,E,RET>, OutputService<O,R,E,RET>> 
// extract a tuple of output types from a tuple of OutputService Context.Tags
export type ExtractOutputType<T> = T extends OutputServiceTag<infer O, infer _R, infer _E, infer _RET> ? O : never;
export type ExtractOutputTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractOutputType<Tuple[Index]>
} & {length: Tuple['length']}
export type ExtractOutputError<T> = T extends OutputServiceTag<infer _O, infer _R, infer E, infer _RET> ? E : never;
export type ExtractOutputErrors<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractOutputError<Tuple[Index]>
} & {length: Tuple['length']}
export type ExtractReturnType<T> = T extends OutputServiceTag<infer _O, infer _R, infer _E, infer RET> ? RET : never;
export type ExtractReturnTypes<Tuple extends [...any[]]> = {
    [Index in keyof Tuple]: ExtractReturnType<Tuple[Index]>
} & {length: Tuple['length']}

// createProgram builds a program which uses the InputServices to gather the
// inputs to the handler and the OutputServices to process the outputs from the handler.
// the resulting program has all the dependent services in the Effect context 
// type
declare function createEventProgram<InputServiceTags extends any [], 
                                    OutputServiceTags extends any []>(
    inputServices: [...InputServiceTags], 
    // the pureHandler is a pure fn which processes simple input data into simple output data
    // cf: re-frame event-handlers
    pureHandler: (...vals: ExtractInputTypes<InputServiceTags>) => ExtractOutputTypes<OutputServiceTags>, 
    outputServices: [...OutputServiceTags]): Effect.Effect<UnionFromTuple<ExtractServiceTypes<InputServiceTags>> | UnionFromTuple<ExtractServiceTypes<OutputServiceTags>>,
                                                           UnionFromTuple<ExtractInputErrors<InputServiceTags>> | UnionFromTuple<ExtractOutputErrors<OutputServiceTags>>, 
                                                           ExtractReturnTypes<OutputServiceTags>>

// what next
// - validate that the OutputServiceTag matches real tags of an OutputService
// - write the createProgram fn ... it will probably be a do simulation, which 
// accumulates the inputs, runs the pure-handler and accumulates the outputs
// then... automatic logging and tracing, error-handling can all be added to the program

// once i have createProgram, then that's the foundation for declaring event handler chains
// then it will need a top-level dispatchSync equivalent ... which will need to enumerate all
// programs at compile-time, to get the Service dependencies... 
// ... will also need to register a dispatchSync service with the context, for dispatch inputs
// and outputs - is that OK ? 
// i can't untangle the dependencies in my head... need to try it