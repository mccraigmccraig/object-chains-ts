import { Effect, Context } from "effect"
import { UnionFromTuple } from "./object_chain_steps.ts"
import { ChainTagged } from "./chain_tag.ts"
import {
    UPObjectChain,
    objectChainServiceImpl
} from "./object_chain.ts"

// union of all the inputs from a tuple of chains
export type ObjectChainInput<T extends UPObjectChain> =
    T extends ObjectChain<infer Input, infer _Steps>
    ? Input
    : never
export type ObjectChainsInputU<
    Tuple extends readonly [...UPObjectChain[]]> = UnionFromTuple<{
        +readonly [Index in keyof Tuple]: ObjectChainInput<Tuple[Index]>
    } & { length: Tuple['length'] }>

export type ObjectChainTagStr<T extends UPObjectChain> =
    T extends ObjectChain<infer _Input, infer _Steps>
    ? T['tagStr']
    : never
export type ObjectChainsTagStrU<
    Tuple extends readonly [...UPObjectChain[]]> = UnionFromTuple<{
        +readonly [Index in keyof Tuple]: ObjectChainTagStr<Tuple[Index]>
    } & { length: Tuple['length'] }>

export type ObjectChainContextTagId<T extends UPObjectChain> =
    T extends ObjectChain<infer Input, infer _Steps>
    ? ChainTag<Input>
    : never
export type ObjectChainsContextTagIdU<
    Tuple extends readonly [...UPObjectChain[]]> = UnionFromTuple<{
        +readonly [Index in keyof Tuple]: ObjectChainContextTagId<Tuple[Index]>
    } & { length: Tuple['length'] }>



export type ProgramReqs<T extends UPObjectChain> =
    ReturnType<T['program']> extends Effect.Effect<infer R, infer _E, infer _V>
    ? R
    : never

export type ProgramsReqsU<Tuple extends readonly [...UPObjectChain[]]> =
    UnionFromTuple<{
        +readonly [Index in keyof Tuple]: ProgramReqs<Tuple[Index]>
    } & { length: Tuple['length'] }>

export type ProgramErrors<T extends UPObjectChain> =
    ReturnType<T['program']> extends Effect.Effect<infer _R, infer E, infer _V>
    ? E
    : never
export type ProgramsErrorsU<Tuple extends readonly [...UPObjectChain[]]> =
    UnionFromTuple<{
        +readonly [Index in keyof Tuple]: ProgramErrors<Tuple[Index]>
    } & { length: Tuple['length'] }>

export type ProgramValue<T extends UPObjectChain> =
    ReturnType<T['program']> extends Effect.Effect<infer _R, infer _E, infer V>
    ? V
    : never

// this indexes a tuple by the element's tagStr property
// https://stackoverflow.com/questions/54599480/typescript-tuple-type-to-object-type  
export type IndexObjectChainTuple<T extends ReadonlyArray<UPObjectChain>> = {
    [K in T[number]['tagStr']]: Extract<T[number], { tagStr: K }>
}

// not obvious - the conditional type distribute the value type over a 
// union of Taggeds, resulting in a union of values!
// https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
export type DistributeObjectChainValueTypes<
    I extends ChainTagged, Chains extends readonly [...UPObjectChain[]]> =
    IndexObjectChainTuple<Chains>[I['_tag']] extends UPObjectChain
    ? ProgramValue<IndexObjectChainTuple<Chains>[I['_tag']]>
    : never

// return a function of the union 
// of all the input types handled by the supplied UPObjectChains,
// which uses a UPObjectChain to handle the input,
// returning the same results as the handling UPObjectChain
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
        const prog = progsByEventTag[i._tag]
        if (prog != undefined) {
            // so prog.program should be the resolved PureWrapperProgram - but 
            // the type is dependent on the actual type of the input
            console.log("multiProg: ", i)
            return prog.program(i) as Effect.Effect<ProgramsReqsU<Chains>,
                ProgramsErrorsU<Chains>,
                Extract<DistributeObjectChainValueTypes<Input, Chains>, Input>>
        } else
            throw "NoProgram for tag: " + i._tag
    }
}

export type MultiChain<Chains extends readonly [...UPObjectChain[]]> = {
    readonly chains: Chains
    readonly chainsByTag: { [index: string]: UPObjectChain }

    readonly program:
    <Input extends ObjectChainsInputU<Chains>>
        (i: Input) => Effect.Effect<ProgramsReqsU<Chains>,
            ProgramsErrorsU<Chains>,
            Extract<DistributeObjectChainValueTypes<Input, Chains>, Input>>
}

export function multiChain<Chains extends readonly [...UPObjectChain[]]>
    (chains: Chains) {

    return {
        chains: chains,
        program: multiChainProgram(chains),
        chainsByTag: chains.reduce(
            (m, p) => { m[p.tagStr] = p; return m },
            {} as { [index: string]: UPObjectChain })
    } as MultiChain<Chains>
}

export function addChains<Chains extends readonly [...UPObjectChain[]],
    AdditionalChains extends readonly [...UPObjectChain[]]>
    (mc: MultiChain<Chains>,
        additionalChains: AdditionalChains) {

    return multiChain([...mc.chains, ...additionalChains])
}

///////////////////////// recursion support

// each chain has a ContextTag for the service which will run it
// so a MultiChain can register Service implementations for each of its
// chains

// return a Context with all the ObjectChain service impls
export function multiChainServicesContext
    <Chains extends readonly [...UPObjectChain[]]>

    (multiChain: MultiChain<Chains>) {

    console.log("objectChainServicesContext")

    const rctx = multiChain.chains.reduce(
        (ctx, ch) => {
            console.log("registering ObjectChainService for:", ch.tagStr)
            return Context.add(ctx, ch.contextTag,
                // deno-lint-ignore no-explicit-any
                objectChainServiceImpl(ch as any))
        },
        Context.empty()
    )
    return rctx as Context.Context<ObjectChainsContextTagIdU<Chains>>
}