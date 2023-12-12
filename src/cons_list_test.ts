import { assertEquals } from "assert"
import * as cl from "./cons_list.ts"

Deno.test("test isNone", () => {
    assertEquals(cl.isNone(cl.None), true)
    assertEquals(cl.isNone(cl.cons()(1, cl.None)), false)
})

Deno.test("test cons", () => {
    assertEquals(cl.cons()(1, cl.None), [1, cl.None])
    assertEquals(cl.cons()(1, cl.cons()(2, cl.None)), [1, [2, cl.None]])
})

Deno.test("test first", () => {
    assertEquals(cl.first()(cl.None), cl.None)
    assertEquals(cl.first()(cl.cons()(1, cl.None)), 1)
    assertEquals(cl.first()(cl.cons()(1, cl.cons()(2, cl.None))), 1)
})

Deno.test("test rest", () => {
    assertEquals(cl.rest()(cl.None), cl.None)
    assertEquals(cl.rest()(cl.cons()(1, cl.None)), cl.None)
    assertEquals(cl.rest()(cl.cons()(1, cl.cons()(2, cl.None))), [2, cl.None])
})

Deno.test("test last", () => {  
    assertEquals(cl.last()(cl.None), cl.None)
    assertEquals(cl.last()(cl.cons()(1, cl.None)), 1)
    assertEquals(cl.last()(cl.cons()(1, cl.cons()(2, cl.None))), 2)
    assertEquals(cl.last()(cl.cons()(1, cl.cons()(2, cl.cons()(3, cl.None)))), 3)
})

Deno.test("test reverse", () => {
    assertEquals(cl.reverse()(cl.None), cl.None)
    assertEquals(cl.reverse()(cl.cons()(1, cl.None)), [1, cl.None])
    assertEquals(cl.reverse()(cl.cons()(1, cl.cons()(2, cl.None))), [2, [1, cl.None]])
    assertEquals(cl.reverse()(cl.cons()(1, cl.cons()(2, cl.cons()(3, cl.None)))), [3, [2, [1, cl.None]]])
})

Deno.test("test append", () => {
    assertEquals(cl.append()(cl.None, 1), [1, cl.None])
    assertEquals(cl.append()(cl.cons()(1, cl.None), 2), [1, [2, cl.None]])
    assertEquals(cl.append()(cl.cons()(1, cl.cons()(2, cl.None)), 3), [1, [2, [3, cl.None]]])
})

Deno.test("test concat", () => {
    assertEquals(cl.concat()(cl.None, cl.None), cl.None)
    assertEquals(cl.concat()(cl.None, cl.cons()(1, cl.None)), [1, cl.None])
    assertEquals(cl.concat()(cl.cons()(1, cl.None), cl.None), [1, cl.None])
    assertEquals(cl.concat()(cl.cons()(1, cl.None), cl.cons()(2, cl.None)), [1, [2, cl.None]])
    assertEquals(cl.concat()(cl.cons()(1, cl.cons()(2, cl.None)), cl.None), [1, [2, cl.None]])
    assertEquals(cl.concat()(cl.cons()(1, cl.None), cl.cons()(2, cl.cons()(3, cl.None))), [1, [2, [3, cl.None]]])
    assertEquals(cl.concat()(cl.cons()(1, cl.cons()(2, cl.None)), cl.cons()(3, cl.cons()(4, cl.None))), [1, [2, [3, [4, cl.None]]]])
})

Deno.test("test toTuple", () => {
    assertEquals(cl.toTuple()(cl.None), [])
    assertEquals(cl.toTuple()(cl.cons()(1, cl.None)), [1])
    assertEquals(cl.toTuple()(cl.cons()(1, cl.cons()(2, cl.None))), [1, 2])
    assertEquals(cl.toTuple()(cl.cons()(1, cl.cons()(2, cl.cons()(3, cl.None)))), [1, 2, 3])
})

Deno.test("fromTuple", () => {
    assertEquals(cl.fromTuple()([]), cl.None)
    assertEquals(cl.fromTuple()([1]), [1, cl.None])
    assertEquals(cl.fromTuple()([1, 2]), [1, [2, cl.None]])
    assertEquals(cl.fromTuple()([1, 2, 3]), [1, [2, [3, cl.None]]])
})