import { Effect } from "effect"
import { UnionFromTuple } from "./object_builders.ts"
import { Tagged } from "./tagged.ts"
import { UPObjectChain, ObjectChainsInputTuple } from "./object_chain.ts"

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

export type ProgramDeps<T extends UPObjectChain> = ReturnType<T['program']> extends Effect.Effect<infer R, infer _E, infer _V>
    ? R
    : never

export type ProgramsDepsU<Tuple extends readonly [...UPObjectChain[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ProgramDeps<Tuple[Index]>
} & { length: Tuple['length'] }>

export type ProgramErrors<T extends UPObjectChain> = ReturnType<T['program']> extends Effect.Effect<infer _R, infer E, infer _V>
    ? E
    : never
export type ProgramsErrorsU<Tuple extends readonly [...UPObjectChain[]]> = UnionFromTuple<{
    +readonly [Index in keyof Tuple]: ProgramErrors<Tuple[Index]>
} & { length: Tuple['length'] }>

export type ProgramValue<T extends UPObjectChain> = ReturnType<T['program']> extends Effect.Effect<infer _R, infer _E, infer V>
    ? V
    : never

// this indexes a tuple by the element's tagStr property
// https://stackoverflow.com/questions/54599480/typescript-tuple-type-to-object-type  
export type IndexObjectChainTuple<T extends ReadonlyArray<UPObjectChain>> = {
    [K in T[number]['tagStr']]: Extract<T[number], { tagStr: K }>
}
// showing that this does indeed index a tuple of UPPureWrapperProgram
// export type X = IndexObjectChainTuple<[
//     { tagStr: "foo", program: (ev: number) => Effect.Effect<never, never, number> },
//     { tagStr: "bar", program: (ev: number) => Effect.Effect<never, never, number> }]>

// not obvious - the conditional type distribute the value type over a union of Taggeds, resulting in a union of values!
// https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
export type DistributeObjectChainValueTypes<I extends Tagged, Chains extends readonly [...UPObjectChain[]]> =
    IndexObjectChainTuple<Chains>[I['tag']] extends UPObjectChain
    ? ProgramValue<IndexObjectChainTuple<Chains>[I['tag']]>
    : never

// return a function of the union 
// of all the input types handled by the supplied UPPureWrapperPrograms,
// which uses a supplied UPPureWrapperProgram to handle the input,
// returning the same results as the supplied UPPureWrapperProgram
export const multiChain =
    <Chains extends readonly [...UPObjectChain[]],
        Inputs extends UnionFromTuple<ObjectChainsInputTuple<Chains>>>
        (eventHandlerPrograms: readonly [...Chains]):
        (i: Inputs) => Effect.Effect<ProgramsDepsU<Chains>,
            ProgramsErrorsU<Chains>,
            DistributeObjectChainValueTypes<Inputs, Chains>> => {

        const progsByEventTag = eventHandlerPrograms.reduce(
            (m, p) => { m[p.tagStr] = p; return m },
            {} as { [index: string]: UPObjectChain })

        return (i: Inputs) => {
            const prog = progsByEventTag[i.tag]
            if (prog != undefined) {
                // so prog.program should be the resolved PureWrapperProgram - but 
                // the type is dependent on the actual type of the input
                console.log("multiProg: ", i)
                return prog.program(i) as Effect.Effect<ProgramsDepsU<Chains>,
                    ProgramsErrorsU<Chains>,
                    DistributeObjectChainValueTypes<Inputs, Chains>>
            } else
                throw "NoProgram for tag: " + i.tag
        }
    }
