import { Effect } from "effect"
import { UnionFromTuple } from "./object_builders.ts"
import { ChainTagged } from "./tagged.ts"
import { UPObjectChain, ObjectChainsInputU } from "./object_chain.ts"


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
export type DistributeObjectChainValueTypes<I extends ChainTagged, Chains extends readonly [...UPObjectChain[]]> =
    IndexObjectChainTuple<Chains>[I['tag']] extends UPObjectChain
    ? ProgramValue<IndexObjectChainTuple<Chains>[I['tag']]>
    : never

// return a function of the union 
// of all the input types handled by the supplied UPPureWrapperPrograms,
// which uses a supplied UPPureWrapperProgram to handle the input,
// returning the same results as the supplied UPPureWrapperProgram
//
// the Effect result type will be narrowed to the union member corresponding
// to the input type when the input is supplied
export function multiChainProgram<Chains extends readonly [...UPObjectChain[]]>

    (chains: readonly [...Chains]) {

    const progsByEventTag = chains.reduce(
        (m, p) => { m[p.tagStr] = p; return m },
        {} as { [index: string]: UPObjectChain })

    // by putting the Input inference site on the returned function, 
    // we can use Extract to select the value type of the Effect 
    // corresponding to the value type of the chain selected by the input
    return <Input extends ObjectChainsInputU<Chains>>(i: Input) => {
        const prog = progsByEventTag[i.tag]
        if (prog != undefined) {
            // so prog.program should be the resolved PureWrapperProgram - but 
            // the type is dependent on the actual type of the input
            console.log("multiProg: ", i)
            return prog.program(i) as Effect.Effect<ProgramsDepsU<Chains>,
                ProgramsErrorsU<Chains>,
                Extract<DistributeObjectChainValueTypes<Input, Chains>, Input>>
        } else
            throw "NoProgram for tag: " + i.tag
    }
}

export type MultiChain<Chains extends readonly [...UPObjectChain[]]> = {
    readonly chains: Chains
    readonly program: <Input extends ObjectChainsInputU<Chains>>(i: Input) => Effect.Effect<ProgramsDepsU<Chains>,
        ProgramsErrorsU<Chains>,
        Extract<DistributeObjectChainValueTypes<Input, Chains>, Input>>
}

export function multiChain<Chains extends readonly [...UPObjectChain[]]>
    (chains: Chains) {
    
    return {
        chains: chains,
        program: multiChainProgram(chains)
    } as MultiChain<Chains>
}

export function addChains<Chains extends readonly [...UPObjectChain[]],
    AdditionalChains extends readonly [...UPObjectChain[]]>
    (mc: MultiChain<Chains>,
        additionalChains: AdditionalChains) {

    return multiChain([...mc.chains, ...additionalChains])
}
