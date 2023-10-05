import {assertEquals} from "https://deno.land/std/assert/mod.ts"
import {Effect, Context} from "npm:effect@^2.0.0-next.44"
import {FxService, handleEventProgram} from "./events.ts";

// this is a type-level id for the service - it must be typeswise unique
export interface TestInputServiceA {readonly _: unique symbol}
// this is the service interface - it may have the same shape as another service (TestInputServiceBI)
export interface TestInputServiceAI extends FxService<number> {
    readonly fx: () => Effect.Effect<never, never, number>}
export const TestInputServiceA = Context.Tag<TestInputServiceA,TestInputServiceAI>("TestInputServiceA")

export interface TestInputServiceB {readonly _: unique symbol}
export interface TestInputServiceBI extends FxService<number> {
    readonly fx: () => Effect.Effect<never, never, number>}
export const TestInputServiceB = Context.Tag<TestInputServiceB,TestInputServiceBI>("TestInputServiceB")

export interface TestOutputServiceC {readonly _: unique symbol}
export interface TestOutputServiceCI extends FxService<[number,number]> {
    readonly fx: (v?: [number,number]) => Effect.Effect<never, never, [number,number]>}
export const TestOutputServiceC = Context.Tag<TestOutputServiceC,TestOutputServiceCI>("TestOutputServiceC")

const pureHandler = (a: number, b: number): [[number,number]] => {
    console.log("a,b", a, b)
    return [[a,b]]}

const prog = handleEventProgram(
    [TestInputServiceA, TestInputServiceB],
    pureHandler,
    [TestOutputServiceC])

const a = Effect.provideService(
    prog,
    TestInputServiceA,
    TestInputServiceA.of({
        fx: () => Effect.succeed(10)}))

const b = Effect.provideService(
    a,
    TestInputServiceB,
    TestInputServiceB.of({
        fx: () => Effect.succeed(5)}))

const c = Effect.provideService(
    b,
    TestOutputServiceC,
    TestOutputServiceC.of( {
        fx: (v?: [number,number]) => {
            console.log("[number,number]", v)
            return Effect.succeed(v===undefined ? [0,0] :v)}}))

Deno.test("test service builder", ()=> {
    const r = Effect.runSync(c)

    assertEquals(r, [[10,5]])})