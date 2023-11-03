import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { EventI, FxService, buildEventHandlerProgram, makeMultiEventHandlerProgram, eventTag } from "./handler_chain.ts"

export interface GetUserEvent extends EventI {
    readonly tag: "GetUserEvent"
    readonly id: string
}
export const GetUserEventTag = eventTag<GetUserEvent>("GetUserEvent")

export interface GetOrgEvent extends EventI {
    tag: "GetOrgEvent"
    id: string
}
export const getOrgEventTag = eventTag<GetOrgEvent>("GetOrgEvent")


// this is a type-level id for the service - it must be typeswise unique
// giving it a name (vs using the literal type { readonly _: unique symbol } for the tag) 
// makes for much more readable program signatures
interface TestInputServiceA { readonly _: unique symbol }
// this is the service interface - it may have the same shape as another service (TestInputServiceBI)

// TODO
// is this problematic - if we have the Event on the fx signature, we need to 
// specialise the service to a specific event type to get a tag ... but this might be fine, 
// if we have Event types with loose additional properties

export interface TestInputServiceAI extends FxService<GetUserEvent, number, string> {
    readonly fx: (ev: GetUserEvent, data: string) => Effect.Effect<never, never, number>
}
export const TestInputServiceA = Context.Tag<TestInputServiceA, TestInputServiceAI>("TestInputServiceA")

interface TestInputServiceB { readonly _: unique symbol }
export interface TestInputServiceBI extends FxService<GetUserEvent,number> {
    readonly fx: (ev: GetUserEvent, _: undefined) => Effect.Effect<never, never, number>
}
export const TestInputServiceB = Context.Tag<TestInputServiceB, TestInputServiceBI>("TestInputServiceB")

interface TestOutputServiceC { readonly _: unique symbol }
export interface TestOutputServiceCI extends FxService<GetUserEvent, string, [number, number]> {
    readonly fx: (ev: GetUserEvent, data: [number, number]) => Effect.Effect<never, never, string>
}
export const TestOutputServiceC = Context.Tag<TestOutputServiceC, TestOutputServiceCI>("TestOutputServiceC")

interface TestInputServiceD { readonly _: unique symbol }
export interface TestInputServiceDI extends FxService<GetOrgEvent, number, string> {
    readonly fx: (ev: GetOrgEvent, data: string) => Effect.Effect<never, never, number>
}
export const TestInputServiceD = Context.Tag<TestInputServiceD, TestInputServiceDI>("TestInputServiceD")

interface TestOutputServiceE { readonly _: unique symbol }
export interface TestOutputServiceEI extends FxService<GetOrgEvent, string, [number, number]> {
    readonly fx: (ev: GetOrgEvent, data: [number, number]) => Effect.Effect<never, never, string>
}
export const TestOutputServiceE = Context.Tag<TestOutputServiceE, TestOutputServiceEI>("TestOutputServiceE")


// bundle some service impls into a Context
const context = Context.empty().pipe(
    Context.add(TestInputServiceA, TestInputServiceA.of({
        fx: (_ev: GetUserEvent, data: string) => Effect.succeed(Number.parseInt(data) + 10)
    })),
    Context.add(
        TestInputServiceB,
        TestInputServiceB.of({
            fx: (_ev: GetUserEvent, _: undefined) => Effect.succeed(5)
        })),
    Context.add(
        TestOutputServiceC,
        TestOutputServiceC.of({
            fx: (_ev: GetUserEvent, data: [number, number]) => {
                console.log("[number,number]", data)
                return Effect.succeed("sum is: " + data.reduce((a, b) => a + b))
            }
        })))

// a pure handler fn - business logic goes here
//
// the params are simple data and must match the 
// value types of the input Services, while the list of return values
// are also simple data which must match the data param types of
// the output Services
const pureHandler = (ev: GetUserEvent, a: number, b: number): [[number, number]] => {
    console.log("event,a,b", ev, a, b)
    return [[a, b]]
}


// build the handler program, which sequences the input services to 
// provide the params to the pureHandler, and the output services to 
// process the list of return values from the pureHandler
const getUserProg = buildEventHandlerProgram(
    GetUserEventTag,
    [{ fxServiceTag: TestInputServiceA, data: "10" },
        TestInputServiceB],
    pureHandler,
    [TestOutputServiceC])    

Deno.test("test single event handler chain", () => {
    const ev: GetUserEvent = {
        tag: "GetUserEvent",
        id: "1234"
    }
    // provide Service impls
    const runnable = Effect.provide(getUserProg.program(ev), context)
    // run the program
    const r = Effect.runSync(runnable)

    assertEquals(r, ["sum is: 25"])
})

// build a handler for multiple event types

const multiProg = makeMultiEventHandlerProgram(
    [getUserProg]
)

Deno.test("test multi-even handler chain", () => {
    const ev: GetUserEvent = {
        tag: "GetUserEvent",
        id: "1234"
    }
    
    // provide Service impls
    const runnable = Effect.provide(multiProg(ev), context)

    // run the program
    const r = Effect.runSync(runnable)

    assertEquals(r, ["sum is: 25"])
})
