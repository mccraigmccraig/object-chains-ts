
// a None element marking an empty cons list 
// or the end of a cons list.
export const NoneTag: unique symbol = Symbol("ConsNone")
export type None = { readonly _tag: typeof NoneTag }
export const None: None = { _tag: NoneTag }

// a type-guard for the None type
// deno-lint-ignore no-explicit-any
export function isNone(v: any): v is None {
    return (('_tag' in v) && (v._tag === NoneTag))
}

// it's probably a cons, but we're only checking
// one level with this type
// deno-lint-ignore no-explicit-any
export type NRCons<T> = None | readonly [T, any]

// unparameterised cons can be used to roughly type arrays
// deno-lint-ignore no-explicit-any
export type UPCons = None | readonly [any, any]

// a Cons type with limited conditional recursion
// T is the base type for the values
export type Cons<T, C> =
    C extends None
    ? None
    : C extends readonly [infer H extends T, infer R]
    ? readonly [H, Cons<T, R>]
    // don't recurse when there is no match,
    // it murders the compiler
    : never

// prepend an element to a cons list (or 
// start a cons list by prepending to None)
export function cons<T>() {
    return function <V extends T, const C>(
        v: V,
        c: C extends Cons<T, C> ? C : Cons<T, C>) {
        return [v, c] as const
    }
}

export type First<T, C> =
    C extends Cons<T, C>
    ? C extends None
    ? None
    : C extends readonly [infer H extends T, infer _R]
    ? H
    : never
    : never

// get the first element from a cons list
export function first<T>() {
    return function <const C>(c: C extends Cons<T, C> ? C : Cons<T, C>)
        : First<T, C> {
        if (isNone(c)) {
            return None as First<T, C>
        } else {
            return c[0] as First<T, C>
        } 
    }
}

export type Rest<T, C> =
    C extends Cons<T, C>
    ? C extends None
    ? None
    : C extends readonly [infer _H extends T, infer R]
    ? R
    : never
    : never

// get the rest of a cons list
export function rest<T>() {
    return function <const C>(c: C extends Cons<T, C> ? C : Cons<T, C>)
        : Rest<T, C> {
        if (isNone(c)) {
            return c as Rest<T, C>
        } else {
            return c[1] as Rest<T, C>
        }
    }
}

export type Last<T, C> =
    C extends None
    ? None
    : C extends readonly [infer F, None]
    ? F
    : C extends readonly [infer _F extends T, infer R]
    ? Last<T, R>
    : never

export function last<T>() {
    return function <const C>(c: C extends Cons<T, C> ? C : Cons<T, C>) {

        let result: Cons<T, None> = None
        let cursor = c
        while (!isNone(cursor)) {
            // deno-lint-ignore no-explicit-any
            result = cursor[0] as any
            cursor = cursor[1]
        }

        return result as Last<T, C>

    }
}

export type Reverse<T, C, Acc = None> =
    C extends Cons<T, C>
    ? C extends None
    ? Acc
    : C extends readonly [infer F extends T, infer R]
    ? Reverse<T, R, readonly [F, Acc]>
    : never
    : never

export function reverse<T>() {
    return function <const C>(c: C extends Cons<T, C> ? C : Cons<T, C>) {

        let result: Cons<T, None> = None
        let cursor = c
        while (!isNone(cursor)) {
            // deno-lint-ignore no-explicit-any
            result = [cursor[0], result] as const as any
            cursor = cursor[1]
        }

        return result as Reverse<T, C>
    }
}

export type Append<T, C, V extends T> =
    C extends None
    ? readonly [V, None]
    : C extends readonly [infer F extends T, infer R]
    ? readonly [F, Append<T, R, V>]
    : never

// append an element to a cons list - 
// NB: builds an entirely new cons list
export function append<T>() {
    return function <const C, V extends T>(
        c: C extends Cons<T, C> ? C : Cons<T, C>,
        v: V) {

        // deno-lint-ignore no-explicit-any
        const reversed = reverse<T>()(c) as any
        const prepended = cons<T>()(v, reversed)
        return reverse<T>()(prepended) as Append<T, C, V>
    }
}

export type ToTuple<T, C, Acc extends readonly T[] = []> =
    C extends None
    ? Acc
    : C extends readonly [infer F extends T, infer R]
    ? ToTuple<T, R, readonly [...Acc, F]>
    : never

export function toTuple<T>() {
    return function
        <const C>
        (c: C extends Cons<T, C> ? C : Cons<T, C>) {
        
        const result = []
        let cursor = c
        while (!isNone(cursor)) {
            result.push(cursor[0])
            cursor = cursor[1]
        }

        return result as ToTuple<T, C> 
    }
}

export type FromTuple<T,
    // deno-lint-ignore no-explicit-any
    Tuple extends readonly [...any[]],
    Acc extends NRCons<T> = None> =

    Tuple extends readonly []
    ? Acc
    : Tuple extends readonly [...infer Front,
        infer Last extends T]
    ? FromTuple<T, Front, readonly [Last, Acc]>
    : never

export function fromTuple<T>() {
    return function
        <const Tuple extends readonly [...T[]]>
        (tuple: Tuple) {

        const list = tuple.toReversed().reduce(
            // deno-lint-ignore no-explicit-any
            (l, v) => cons<T>()(v, l) as any,
            None
        )

        return list as FromTuple<T, Tuple>
    }
}

// itereatively build a list
export const a = cons<number>()(2, None)
export const b = cons<number>()(1, a)
export const c = cons<number>()(0, b)

// get some first elements
export const hn = first<number>()(None)
export const ha = first<number>()(a)
export const hb = first<number>()(b)
export const hc = first<number>()(c)

// get some last elements
export const ln = last<number>()(None)
export const la = last<number>()(a)
export const lb = last<number>()(b)
export const lc = last<number>()(c)

// get some rests
export const rn = rest()(None)
export const ra = rest()(a)
export const rb = rest()(b)
export const rc = rest()(c)

// reverse a list
export const revn = reverse<number>()(None)
export const reva = reverse<number>()(a)
export const revb = reverse<number>()(b)
export const revc = reverse<number>()(c)

// append to a list 
export const appn = append<number>()(None, 100)
export const appa = append<number>()(a, 100)
export const appb = append<number>()(b, 100)
export const appc = append<number>()(c, 100)

// convert to a tuple 
export const tupn = toTuple<number>()(None)
export const tupa = toTuple<number>()(a)
export const tupb = toTuple<number>()(b)
export const tupc = toTuple<number>()(c)

// convert from tuple 
export const ftupn = fromTuple<number>()([])
export const ftupa = fromTuple<number>()([0])
export const ftupb = fromTuple<number>()([0, 1, 2, 3])