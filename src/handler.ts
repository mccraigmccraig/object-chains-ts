import { Effect } from "effect"
import { UnionFromTuple } from "./object_builders.ts"
import { Tagged, UPPureWrapperProgram, PureWrapperProgramsInputTuple } from "./pure_wrapper.ts"

// to type the multi-chain handler, need something like 
// a conditional type which will look up return types from the program map object

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


// this indexes a tuple by the element's eventTagStr property
// https://stackoverflow.com/questions/54599480/typescript-tuple-type-to-object-type  
export type IndexPureWrapperProgramTuple<T extends Array<UPPureWrapperProgram>> = {
    [K in T[number]['tagStr']]: Extract<T[number], { tagStr: K }>
}
// showing that this does indeed index a tuple of UPPureWrapperProgram
export type X = IndexPureWrapperProgramTuple<[
    { tagStr: "foo", program: (ev: number) => Effect.Effect<never,never,number> },
    { tagStr: "bar", program: (ev: number) => Effect.Effect<never,never,number> }]>

export type ProgramDeps<T extends UPPureWrapperProgram> = ReturnType<T['program']> extends Effect.Effect<infer R, infer _E, infer _V> 
    ? R
    : never

export type ProgramsDepsU<Tuple extends readonly [...UPPureWrapperProgram[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ProgramDeps<Tuple[Index]>
} & { length: Tuple['length'] }>

export type ProgramErrors<T extends UPPureWrapperProgram> = ReturnType<T['program']> extends Effect.Effect<infer _R, infer E, infer _V> 
    ? E
    : never
    export type ProgramsErrorsU<Tuple extends readonly [...UPPureWrapperProgram[]]> = UnionFromTuple<{
        +readonly [Index in keyof Tuple]: ProgramErrors<Tuple[Index]>
    } & { length: Tuple['length'] }>
    
export type ProgramValue<T extends UPPureWrapperProgram> = ReturnType<T['program']> extends Effect.Effect<infer _R, infer _E, infer V> 
    ? V
    : never

// not obvious - the conditional type distribute the value type over a union of Taggeds, resulting in a union of values!
// https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
export type DistributeProgramValueTypes<I extends Tagged, Progs extends [...UPPureWrapperProgram[]]> =
    IndexPureWrapperProgramTuple<Progs>[I['tag']] extends UPPureWrapperProgram
    ? ProgramValue<IndexPureWrapperProgramTuple<Progs>[I['tag']]>
    : never

// return a function of the union 
// of all the input types handled by the supplied UPPureWrapperPrograms,
// which uses a supplied UPPureWrapperProgram to handle the input,
// returning the same results as the supplied UPPureWrapperProgram
export const makeHandlerProgram =
    <Programs extends [...UPPureWrapperProgram[]],
        Inputs extends UnionFromTuple<PureWrapperProgramsInputTuple<Programs>>>
        (eventHandlerPrograms: [...Programs]):
        (i: Inputs) => Effect.Effect<ProgramsDepsU<Programs>,
            ProgramsErrorsU<Programs>,
            DistributeProgramValueTypes<Inputs, Programs>> => {

        const progsByEventTag = eventHandlerPrograms.reduce(
            (m, p) => { m[p.tagStr] = p; return m },
            {} as { [index: string]: UPPureWrapperProgram })

        return (i: Inputs) => {
            const prog = progsByEventTag[i.tag]
            if (prog != undefined) {
                // so prog.program should be the resolved PureWrapperProgram - but 
                // the type is dependent on the actual type of the input
                console.log("multiProg: ", i)
                return prog.program(i) as Effect.Effect<ProgramsDepsU<Programs>,
                    ProgramsErrorsU<Programs>,
                    DistributeProgramValueTypes<Inputs, Programs>>
            } else
                throw "NoProgram for tag: " + i.tag
        }
    }
