import { assertEquals } from "assert"
import * as cl from "./cons_list.ts"

// IntelliSesnse examples

// itereatively build a list
export const a = cl.cons<number>()(2, cl.None)
export const b = cl.cons<number>()(1, a)
export const c = cl.cons<number>()(0, b)

// get some first elements
export const hn = cl.first<number>()(cl.None)
export const ha = cl.first<number>()(a)
export const hb = cl.first<number>()(b)
export const hc = cl.first<number>()(c)

// get some last elements
export const ln = cl.last<number>()(cl.None)
export const la = cl.last<number>()(a)
export const lb = cl.last<number>()(b)
export const lc = cl.last<number>()(c)

// get some rests
export const rn = cl.rest()(cl.None)
export const ra = cl.rest()(a)
export const rb = cl.rest()(b)
export const rc = cl.rest()(c)

// reverse a list
export const revn = cl.reverse<number>()(cl.None)
export const reva = cl.reverse<number>()(a)
export const revb = cl.reverse<number>()(b)
export const revc = cl.reverse<number>()(c)

// append to a list 
export const appn = cl.append<number>()(cl.None, 100)
export const appa = cl.append<number>()(a, 100)
export const appb = cl.append<number>()(b, 100)
export const appc = cl.append<number>()(c, 100)

// concatenate lists
export const conn = cl.concat<number>()(cl.None, cl.None)
export const conna = cl.concat<number>()(cl.None, c)
export const connb = cl.concat<number>()(c, cl.None)
export const connc = cl.concat<number>()(c, c)

// convert to a tuple 
export const tupn = cl.toTuple<number>()(cl.None)
export const tupa = cl.toTuple<number>()(a)
export const tupb = cl.toTuple<number>()(b)
export const tupc = cl.toTuple<number>()(c)

// convert from tuple 
export const ftupn = cl.fromTuple<number>()([])
export const ftupa = cl.fromTuple<number>()([0])
export const ftupb = cl.fromTuple<number>()([0, 1, 2, 3])

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