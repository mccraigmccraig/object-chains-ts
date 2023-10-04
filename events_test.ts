import {assertEquals} from "https://deno.land/std/assert/mod.ts"
import {Effect, Context} from "npm:effect@^2.0.0-next.44"
import {FxService, handleEventProgram} from "./events.ts";

export interface TestInputServiceA extends FxService<number> {
    readonly fx: () => Effect.Effect<never, never, number>}
export const TestInputServiceA = Context.Tag<TestInputServiceA>("TestInputServiceA")

export interface TestInputServiceB extends FxService<string> {
    readonly fx: () => Effect.Effect<never, never, string>}
export const TestInputServiceB = Context.Tag<TestInputServiceB>("TestInputServiceB")

export interface TestOutputServiceC extends FxService<[number,string]> {
    readonly fx: (v?: [number,string]) => Effect.Effect<never, never, [number,string]>}
export const TestOutputServiceC = Context.Tag<TestOutputServiceC,TestOutputServiceC>("TestOutputServiceC")

const pureHandler = (a: number, b: string): [[number,string]] => {
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
        fx: () => Effect.succeed("5")}))

const c = Effect.provideService(
    b,
    TestOutputServiceC,
    TestOutputServiceC.of( {
        fx: (v?: [number,string]) => {
            console.log("[number,string]", v)
            return Effect.succeed(v===undefined ? [0,"nope"] :v)}}))

Deno.test("test service builder", ()=> {
    const r = Effect.runSync(c)

    assertEquals(r, [[10,"5"]])})