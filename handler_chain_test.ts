import { assertEquals } from "https://deno.land/std/assert/mod.ts"
import { Effect, Context } from "npm:effect@^2.0.0-next.44"
import { FxService, handleEventProgram } from "./handler_chain.ts";

// this is a type-level id for the service - it must be typeswise unique
export interface TestInputServiceA { readonly _: unique symbol }
// this is the service interface - it may have the same shape as another service (TestInputServiceBI)
export interface TestInputServiceAI extends FxService<number> {
    readonly fx: () => Effect.Effect<never, never, number>
}
export const TestInputServiceA = Context.Tag<TestInputServiceA, TestInputServiceAI>("TestInputServiceA")

export interface TestInputServiceB { readonly _: unique symbol }
export interface TestInputServiceBI extends FxService<number> {
    readonly fx: () => Effect.Effect<never, never, number>
}
export const TestInputServiceB = Context.Tag<TestInputServiceB, TestInputServiceBI>("TestInputServiceB")

export interface TestOutputServiceC { readonly _: unique symbol }
export interface TestOutputServiceCI extends FxService<string, [number,number]> {
    readonly fx: (v?: [number, number]) => Effect.Effect<never, never, string>
}
export const TestOutputServiceC = Context.Tag<TestOutputServiceC, TestOutputServiceCI>("TestOutputServiceC")

// bundle some service impls into a Context
const context = Context.empty().pipe(
    Context.add(TestInputServiceA, TestInputServiceA.of({
        fx: () => Effect.succeed(10)
    })),
    Context.add(
        TestInputServiceB,
        TestInputServiceB.of({
            fx: () => Effect.succeed(5)
        })),
    Context.add(
        TestOutputServiceC,
        TestOutputServiceC.of({
            fx: (v?: [number, number]) => {
                console.log("[number,number]", v)
                return Effect.succeed(v === undefined ? "nothing to see here" : "sum is: " + v.reduce((a,b)=>a+b))
            }
        })))

// a pure handler fn - business logic goes here
//
// the params are simple data and must match the 
// value types of the input Services, while the list of return values
// are also simple data which must match the data param types of
// the output Services
const pureHandler = (a: number, b: number): [[number, number]] => {
    console.log("a,b", a, b)
    return [[a, b]]
}

// build the handler program, which sequences the input services to 
// provide the params to the pureHandler, and the output services to 
// process the list of return values from the pureHandler
const prog = handleEventProgram(
    [TestInputServiceA, TestInputServiceB],
    pureHandler,
    [TestOutputServiceC])

Deno.test("test service builder", () => {

    // provide Service impls
    const runnable = Effect.provide(prog, context)

    // run the program
    const r = Effect.runSync(runnable)

    assertEquals(r, ["sum is: 15"])
})