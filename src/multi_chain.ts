import { Effect, Context } from "effect"
import { UnionFromTuple } from "./object_chain_steps.ts"
import { ChainTagged } from "./chain_tag.ts"
import {
    UPObjectChain,
    UPObjectChainInput,
    UPObjectChainContextTag,
    UPObjectChainProgramReqs,
    UPObjectChainProgramErrors,
    UPObjectChainProgramValue,
    objectChainServiceImpl
} from "./object_chain.ts"

export type ObjectChainList = readonly [...UPObjectChain[]]

// union of all the inputs from a tuple of chains
export type ObjectChainsInputU<
    Tuple extends ObjectChainList> = UnionFromTuple<{
        +readonly [Index in keyof Tuple]: UPObjectChainInput<Tuple[Index]>
    } & { length: Tuple['length'] }>

// union of all the tagStrs from a tuple of chains
export type ObjectChainsTagStrU<
    Tuple extends ObjectChainList> = UnionFromTuple<{
        +readonly [Index in keyof Tuple]: Tuple[Index]['tagStr']
    } & { length: Tuple['length'] }>

// union of all the ContextTagId from a tuple of chains
export type ObjectChainsContextTagIdU<
    Tuple extends ObjectChainList> = UnionFromTuple<{
        +readonly [Index in keyof Tuple]: UPObjectChainContextTag<Tuple[Index]>
    } & { length: Tuple['length'] }>

export type ObjectChainsProgramsReqsU<Tuple extends ObjectChainList> =
    UnionFromTuple<{
        +readonly [Index in keyof Tuple]: UPObjectChainProgramReqs<Tuple[Index]>
    } & { length: Tuple['length'] }>

export type ObjectChainsProgramsErrorsU<Tuple extends ObjectChainList> =
    UnionFromTuple<{
        +readonly [Index in keyof Tuple]: UPObjectChainProgramErrors<Tuple[Index]>
    } & { length: Tuple['length'] }>

// this indexes a tuple by the element's tagStr property
// https://stackoverflow.com/questions/54599480/typescript-tuple-type-to-object-type  
export type IndexObjectChainTuple<T extends ReadonlyArray<UPObjectChain>> = {
    [K in T[number]['tagStr']]: Extract<T[number], { tagStr: K }>
}

// not obvious - the conditional type distribute the value type over a 
// union of Taggeds, resulting in a union of values!
// https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
export type DistributeObjectChainValueTypes<
    I extends ChainTagged, Chains extends ObjectChainList> =
    IndexObjectChainTuple<Chains>[I['_tag']] extends UPObjectChain
    ? UPObjectChainProgramValue<IndexObjectChainTuple<Chains>[I['_tag']]>
    : never

// type of the Effect returned by a MultiChain's program
export type MultiChainProgramEffect<
    Chains extends ObjectChainList,
    Input extends ObjectChainsInputU<Chains>> =

    Effect.Effect<ObjectChainsProgramsReqsU<Chains>,
        ObjectChainsProgramsErrorsU<Chains>,
        Extract<DistributeObjectChainValueTypes<ObjectChainsInputU<Chains>,
            Chains>,
            Input>>

export type MultiChainProgram<Chains extends ObjectChainList> =
    <Input extends ObjectChainsInputU<Chains>>
        (i: Input) =>
        MultiChainProgramEffect<Chains, Input>

// export type MultiChainService


// return a function of the union 
// of all the input types handled by the supplied UPObjectChains,
// which uses a UPObjectChain to handle the input,
// returning the same results as the handling UPObjectChain
//
// the Effect result type will be narrowed to the union member corresponding
// to the input type when the input is supplied
export function multiChainProgram<const Chains extends ObjectChainList>

    (chains: Chains) {

    const progsByEventTag = chains.reduce(
        (m, p) => { m[p.tagStr] = p; return m },
        {} as { [index: string]: UPObjectChain })

    // by putting the Input inference site on the returned function, 
    // we can use Extract to select the value type of the Effect 
    // corresponding to the value type of the chain selected by the input
    return <Input extends ObjectChainsInputU<Chains>>(i: Input) => {
        const prog = progsByEventTag[i._tag]
        if (prog != undefined) {
            console.log("multiProg: ", i)
            // could use MultiChainProgramEffect type here, but it leads
            // to worse IntelliSense
            return prog.program(i) as Effect.Effect<ObjectChainsProgramsReqsU<Chains>,
                ObjectChainsProgramsErrorsU<Chains>,
                Extract<DistributeObjectChainValueTypes<Input, Chains>, Input>>
        } else
            throw "NoProgram for tag: " + i._tag
    }
}

export type MultiChain<Chains extends ObjectChainList> = {
    readonly chains: Chains
    readonly chainsByTag: { [index: string]: UPObjectChain }

    // could use MultiChainProgram type here, but it leads 
    // to worse IntelliSense - this way we get to the Effect 
    // ASAP
    readonly program: <Input extends ObjectChainsInputU<Chains>>
        (i: Input) => Effect.Effect<ObjectChainsProgramsReqsU<Chains>,
            ObjectChainsProgramsErrorsU<Chains>,
            Extract<DistributeObjectChainValueTypes<Input, Chains>, Input>>
}

export function multiChain<const Chains extends ObjectChainList>
    (chains: Chains) {

    return {
        chains: chains,
        program: multiChainProgram(chains),
        chainsByTag: chains.reduce(
            (m, p) => { m[p.tagStr] = p; return m },
            {} as { [index: string]: UPObjectChain })
    } as MultiChain<Chains>
}

export function addChains<const Chains extends ObjectChainList,
    AdditionalChains extends ObjectChainList>
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
    <const Chains extends ObjectChainList>

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

export function multiChainFxFn
    <const Chains extends ObjectChainList>
    (multiChain: MultiChain<Chains>) {


    return <Input extends ObjectChainsInputU<Chains>>
        (i: Input) => {
        return undefined as unknown as MultiChainProgramEffect<Chains, Input>
    }
}